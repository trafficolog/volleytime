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
restore_previous() {
  local old="$1" candidate="$2" switch_started="$3" old_web old_bot
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
  mark rolling-back
  git reset --hard "$old" >/dev/null || fail "Git rollback failed"
  atomic_install "$old_snapshot" "$manifest" || fail "old manifest restore failed"
  if [ "$switch_started" = yes ]; then
    "${compose[@]}" up --no-build -d web bot || fail "old runtime restart failed"
  fi
  for path in "$previous_manifest" "$previous_pointer"; do
    if [ -f "$history_snapshot/$(basename "$path")" ]; then
      atomic_install "$history_snapshot/$(basename "$path")" "$path" || fail "previous history restore failed"
    else
      rm -f -- "$path" || fail "previous history removal failed"
    fi
  done
  if wait_ready; then
    mark rolled-back
  else
    result=$?
    controlled_failure "$result"
    fail "old runtime readiness exhausted after rollback; previous history restored"
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
