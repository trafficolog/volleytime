#!/usr/bin/env bash
set -euo pipefail
umask 077

fail() { echo "GHCR manual deploy: $*; manual recovery checkpoint" >&2; exit 1; }
valid_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }
[ "$#" -ge 2 ] || fail "usage: deploy-ghcr-manual.sh deploy STAGING_DIR FULL_SHA GHCR_PREFIX | rollback FULL_SHA"
mode="$1"
case "$mode" in
  deploy) [ "$#" -eq 4 ] || fail "deploy needs staging, SHA and GHCR prefix"; staging="$2"; wanted="$3"; prefix="$4" ;;
  rollback) [ "$#" -eq 2 ] || fail "rollback needs full SHA"; wanted="$2" ;;
  *) fail "unknown mode" ;;
esac
valid_sha "$wanted" || fail "release SHA must be full lowercase SHA"
# Detached Compose startup must allow production's 30-second healthcheck interval.
health_attempts="${GHCR_HEALTH_ATTEMPTS:-24}"
health_delay="${GHCR_HEALTH_SLEEP_SECONDS:-5}"
[[ "$health_attempts" =~ ^[1-9][0-9]?$ ]] && [ "$health_attempts" -le 60 ] || fail "readiness attempts must be between 1 and 60"
[[ "$health_delay" =~ ^(0|[1-9]|10)$ ]] || fail "readiness delay must be between 0 and 10 seconds"
if [ "$mode" = deploy ]; then
  [[ "$prefix" =~ ^ghcr\.io/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail "invalid GHCR repository prefix"
fi

root="${VOLLEYTIME_ROOT:-/opt/volleytime}"
helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$root"
[ -f .env ] && [ -f docker-compose.prod.yml ] || fail "production env or Compose file is missing"
exec 9>.deploy/image-bundle.lock
flock -n 9 || fail "another activation holds the lock"
manifest=.env.images
previous_manifest=.env.images.previous
previous_pointer=.deploy/previous-git-sha
phase_file=.deploy/ghcr-manual-phase
old_snapshot=".deploy/ghcr-old-manifest-$wanted"
history_snapshot=".deploy/ghcr-history-$wanted"
compose=(docker compose -f docker-compose.prod.yml --env-file .env --env-file .env.images)

manifest_value() { sed -n "s/^$2=//p" "$1"; }
clean_prod() {
  [ "$(git branch --show-current)" = prod ] && [ -z "$(git status --porcelain --untracked-files=no)" ]
}
mark() {
  local temp
  temp="$(mktemp .deploy/.ghcr-manual-phase.XXXXXX)"
  printf '%s %s\n' "$1" "$wanted" > "$temp"
  chmod 600 "$temp"
  mv -f "$temp" "$phase_file"
}
controlled_failure() {
  case "$1" in
    124 | 137 | 143 | 255) fail "operation timed out or was interrupted; inspect phase, PID, lock, Git, images, schema and exact health before retry" ;;
  esac
}
wait_ready() {
  local attempt result
  for ((attempt = 1; attempt <= health_attempts; attempt++)); do
    if GHCR_REQUIRE_STAGED_ENV=0 bash "$helper_dir/verify-ghcr-deploy-state.sh" >/dev/null 2>&1; then
      return 0
    else
      result=$?
      case "$result" in 124 | 137 | 143 | 255) return "$result" ;; esac
    fi
    if [ "$attempt" -lt "$health_attempts" ]; then
      sleep "$health_delay" || return "$?"
    fi
  done
  echo "GHCR manual deploy: readiness exhausted after $health_attempts attempts" >&2
  return 1
}
atomic_install() {
  local temp
  temp="$(mktemp "$(dirname "$2")/.ghcr-state.XXXXXX")"
  install -m 600 "$1" "$temp" && mv -f "$temp" "$2"
}
runtime_allowed() {
  local service="$1" old_image="$2" candidate_image="$3" identity image
  identity="$(docker inspect --format '{{.State.Running}}|{{.State.Health.Status}}|{{.Config.Image}}' "vt_$service")" || return 1
  image="${identity##*|}"
  [ "$image" = "$old_image" ] || [ "$image" = "$candidate_image" ]
}
check_image_checkpoint() {
  [ ! -e .deploy/image-bundle-phase ] || {
    local image_sha web prefix
    local -a image_marker ghcr_marker
    [ -f .deploy/image-bundle-phase ] || fail "image checkpoint is unreadable"
    mapfile -t image_marker < .deploy/image-bundle-phase || fail "image checkpoint is unreadable"
    [ "${#image_marker[@]}" -eq 1 ] && [[ "${image_marker[0]}" =~ ^smoke-passed\ ([0-9a-f]{40})$ ]] || fail "image checkpoint is unfinished or malformed"
    image_sha="${BASH_REMATCH[1]}"
    web="$(manifest_value "$manifest" WEB_IMAGE)"
    if [ "$image_sha" = "$old" ] && [ "$web" = "volleytime-web:$old" ]; then
      return 0
    fi
    # Only an exact healthy GHCR handoff explains an older completed image.
    [ "$image_sha" != "$old" ] && [ -f "$phase_file" ] || fail "image checkpoint does not match current release"
    mapfile -t ghcr_marker < "$phase_file" || fail "image checkpoint GHCR proof is unreadable"
    [ "${#ghcr_marker[@]}" -eq 1 ] && [ "${ghcr_marker[0]}" = "activated $old" ] || fail "image checkpoint lacks a current GHCR handoff"
    [[ "$web" =~ ^(ghcr\.io/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/)web:$old$ ]] || fail "image checkpoint requires a current GHCR manifest"
    prefix="${BASH_REMATCH[1]}"
    [ "$(manifest_value "$manifest" BOT_IMAGE)" = "${prefix}bot:$old" ] &&
      [ "$(manifest_value "$manifest" MIGRATOR_IMAGE)" = "${prefix}migrator:$old" ] || fail "image checkpoint GHCR images disagree"
    git cat-file -e "$image_sha^{commit}" 2>/dev/null &&
      git merge-base --is-ancestor "$image_sha" "$old" || fail "image checkpoint is not ancestral to current GHCR release"
  }
}
restore_previous() {
  local old="$1" candidate="$2" switch_started="$3" old_web old_bot recovery_state captured
  valid_sha "$old" || fail "old runtime SHA is invalid"
  [ -f "$old_snapshot" ] || fail "old manifest snapshot is missing"
  [ -d "$history_snapshot" ] || fail "previous history snapshot is missing"
  [ "$(manifest_value "$old_snapshot" RELEASE_VERSION)" = "$old" ] || fail "old snapshot SHA mismatch"
  clean_prod || fail "checkout is dirty before rollback"
  [ "$(git rev-parse HEAD)" = "$candidate" ] || fail "checkout is not the exact candidate before rollback"
  old_web="$(manifest_value "$old_snapshot" WEB_IMAGE)"
  old_bot="$(manifest_value "$old_snapshot" BOT_IMAGE)"
  candidate_web="$(manifest_value "$manifest" WEB_IMAGE)"
  candidate_bot="$(manifest_value "$manifest" BOT_IMAGE)"
  runtime_allowed web "$old_web" "$candidate_web" || fail "web runtime is ambiguous before rollback"
  runtime_allowed bot "$old_bot" "$candidate_bot" || fail "bot runtime is ambiguous before rollback"
  for image in "$old_web" "$old_bot" "$(manifest_value "$old_snapshot" MIGRATOR_IMAGE)"; do
    docker image inspect "$image" >/dev/null 2>&1 || fail "old image is unavailable before rollback"
  done
  recovery_state="$(mktemp -d .deploy/.split-recovery.XXXXXX)"
  captured="$recovery_state/runtime"
  install -m 600 .env "$recovery_state/env"
  install -m 600 "$manifest" "$recovery_state/manifest"
  for path in "$previous_manifest" "$previous_pointer"; do
    [ ! -e "$path" ] || install -m 600 "$path" "$recovery_state/$(basename "$path")"
  done
  printf '%s\n' "$candidate" > "$recovery_state/git-sha"
  if bash "$helper_dir/verify-split-rollback.sh" "$old_web" "$old_bot" "$captured"; then :; else
    mark rollback-denied
    fail "split compatibility guard denied downgrade; Git=$candidate, manifest/env/history unchanged, captured=$captured"
  fi
  recover_captured_current() {
    local reason="$1"
    git reset --hard "$candidate" >/dev/null &&
      atomic_install "$recovery_state/manifest" "$manifest" &&
      atomic_install "$recovery_state/env" .env || fail "$reason; exact source/config recovery failed; snapshot=$recovery_state"
    for path in "$previous_manifest" "$previous_pointer"; do
      if [ -f "$recovery_state/$(basename "$path")" ]; then
        atomic_install "$recovery_state/$(basename "$path")" "$path" || fail "$reason; exact history recovery failed; snapshot=$recovery_state"
      else
        rm -f -- "$path" || fail "$reason; exact history recovery failed; snapshot=$recovery_state"
      fi
    done
    bash "$helper_dir/verify-split-rollback.sh" recover "$captured" || {
      mark rollback-recovery-failed
      fail "$reason; captured recovery unconfirmed; Git=$(git rev-parse HEAD), manifest=$manifest, env=.env, snapshot=$recovery_state; reviewed roll-forward required"
    }
    mark rollback-denied
    fail "$reason; captured current restored; Git=$candidate, manifest/env/history restored from $recovery_state; review runtime health before roll-forward"
  }
  bash "$helper_dir/verify-split-rollback.sh" recheck "$captured" || recover_captured_current "writer recheck failed"
  mark rolling-back
  git reset --hard "$old" >/dev/null || recover_captured_current "Git rollback failed"
  atomic_install "$old_snapshot" "$manifest" || recover_captured_current "old manifest restore failed"
  bash "$helper_dir/verify-split-rollback.sh" recheck "$captured" || recover_captured_current "writer recheck failed before activation"
  if [ "$switch_started" = yes ]; then
    "${compose[@]}" up --no-build -d web bot || recover_captured_current "old runtime activation failed"
  else
    bash "$helper_dir/verify-split-rollback.sh" recover "$captured" || recover_captured_current "unchanged runtime restart failed"
  fi
  for path in "$previous_manifest" "$previous_pointer"; do
    if [ -f "$history_snapshot/$(basename "$path")" ]; then
      atomic_install "$history_snapshot/$(basename "$path")" "$path" || recover_captured_current "previous history restore failed"
    else
      rm -f -- "$path" || recover_captured_current "previous history removal failed"
    fi
  done
  if wait_ready; then
    mark rolled-back
  else
    result=$?
    recover_captured_current "old runtime readiness exhausted after rollback"
  fi
}

if [ "$mode" = rollback ]; then
  [ -f "$phase_file" ] || fail "activation phase is missing"
  read -r phase phase_sha < "$phase_file"
  [ "$phase" = activated ] && [ "$phase_sha" = "$wanted" ] || fail "candidate is not eligible for rollback"
  [ -f "$old_snapshot" ] || fail "old manifest snapshot is missing"
  old="$(manifest_value "$old_snapshot" RELEASE_VERSION)"
  [ "$(cat "$previous_pointer" 2>/dev/null || true)" = "$old" ] || fail "previous pointer mismatch"
  cmp -s "$old_snapshot" "$previous_manifest" || fail "previous manifest mismatch"
  restore_previous "$old" "$wanted" yes
  exit 0
fi

[ -d "$staging" ] && [ -f "$staging/release.bundle" ] || fail "staged bundle is missing"
[ -f "$staging/.env.production" ] || fail "staged env is missing"
GHCR_REQUIRE_STAGED_ENV=1 GHCR_STAGED_ENV="$staging/.env.production" bash "$helper_dir/verify-ghcr-deploy-state.sh" || fail "current runtime is not consistent"
clean_prod || fail "checkout is dirty or not prod"
old="$(manifest_value "$manifest" RELEASE_VERSION)"
valid_sha "$old" || fail "old manifest SHA is invalid"
[ "$(git rev-parse HEAD)" = "$old" ] || fail "checkout does not match healthy old runtime"
check_image_checkpoint
[ "$old" != "$wanted" ] || fail "target is already live; inspect before same-SHA retry"
bash "$helper_dir/release-bundle.sh" verify --repo "$root" --bundle "$staging/release.bundle" --expected "$wanted" || fail "Git bundle verification failed"
ref="$(git bundle list-heads "$staging/release.bundle" | awk -v sha="$wanted" '$1 == sha {print $2; exit}')"
[ -n "$ref" ] || fail "bundle does not advertise expected commit"
git fetch --no-tags "$staging/release.bundle" "$ref" >/dev/null || fail "bundle fetch failed"
[ "$(git rev-parse FETCH_HEAD)" = "$wanted" ] || fail "bundle fetched wrong commit"
git merge-base --is-ancestor HEAD FETCH_HEAD || fail "bundle is not fast-forward"

candidate_manifest="$(mktemp .deploy/.ghcr-candidate.XXXXXX)"
printf 'WEB_IMAGE=%s/web:%s\nBOT_IMAGE=%s/bot:%s\nMIGRATOR_IMAGE=%s/migrator:%s\nRELEASE_VERSION=%s\n' \
  "$prefix" "$wanted" "$prefix" "$wanted" "$prefix" "$wanted" "$wanted" > "$candidate_manifest"
chmod 600 "$candidate_manifest"
[ ! -e "$old_snapshot" ] && [ ! -e "$history_snapshot" ] || fail "prior attempt exists; inspect before rerun"

bash "$helper_dir/backup-local.sh" || fail "backup failed before GHCR activation"
[ -e "$old_snapshot" ] || install -m 600 "$manifest" "$old_snapshot" || fail "old manifest snapshot failed"
install -d -m 700 "$history_snapshot"
for path in "$previous_manifest" "$previous_pointer"; do
  [ ! -e "$path" ] || install -m 600 "$path" "$history_snapshot/$(basename "$path")" || fail "previous history snapshot failed"
done
mark backed-up
docker compose -f docker-compose.prod.yml --env-file .env --env-file "$candidate_manifest" pull web bot migrate || fail "GHCR image pull failed; old runtime retained"
for service in web bot migrator; do
  docker image inspect "$prefix/$service:$wanted" >/dev/null 2>&1 || fail "pulled $service image is unavailable"
done

bash "$helper_dir/release-bundle.sh" advance --repo "$root" --bundle "$staging/release.bundle" --expected "$wanted" || fail "Git advancement is ambiguous"
[ "$(git rev-parse HEAD)" = "$wanted" ] || fail "Git advancement did not reach expected SHA"
atomic_install "$candidate_manifest" "$manifest" || fail "candidate manifest install failed"
mark migrating
if "${compose[@]}" run --rm migrate; then
  mark migrated
else
  result=$?
  controlled_failure "$result"
  restore_previous "$old" "$wanted" no
  fail "migration failed; old source and manifest restored"
fi
mark activating
if "${compose[@]}" up --no-build -d web bot; then
  mark checking-health
else
  result=$?
  controlled_failure "$result"
  restore_previous "$old" "$wanted" yes
  fail "activation failed; old source and runtime restored"
fi
if wait_ready; then
  :
else
  result=$?
  controlled_failure "$result"
  restore_previous "$old" "$wanted" yes
  fail "candidate readiness exhausted; old release restored"
fi
atomic_install "$old_snapshot" "$previous_manifest" || fail "previous manifest update failed"
pointer_temp="$(mktemp .deploy/.previous-git-sha.XXXXXX)"
printf '%s\n' "$old" > "$pointer_temp"
chmod 600 "$pointer_temp"
mv -f "$pointer_temp" "$previous_pointer"
mark activated
rm -f -- "$staging/.env.production" "$candidate_manifest"
echo "GHCR manual candidate activated: $wanted; external synthetic smoke pending"
