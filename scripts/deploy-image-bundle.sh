#!/usr/bin/env bash
set -euo pipefail
umask 077

fail() { echo "image-bundle: $*; manual recovery checkpoint" >&2; exit 1; }
valid_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }

[ "$#" -ge 2 ] || fail "usage: deploy-image-bundle.sh deploy STAGING_DIR FULL_SHA | rollback FULL_SHA | confirm-smoke FULL_SHA | prune-retained FULL_SHA [--dry-run]"
mode="$1"
dry_run=no
case "$mode" in
  deploy) [ "$#" -eq 3 ] || fail "deploy needs staging directory and full SHA"; staging="$2"; wanted="$3" ;;
  rollback) [ "$#" -eq 2 ] || fail "rollback needs full SHA"; wanted="$2" ;;
  confirm-smoke) [ "$#" -eq 2 ] || fail "confirm-smoke needs full SHA"; wanted="$2" ;;
  prune-retained)
    { [ "$#" -eq 2 ] || { [ "$#" -eq 3 ] && [ "$3" = --dry-run ]; }; } || fail "prune-retained needs full SHA and optional --dry-run"
    wanted="$2"
    [ "$#" -eq 2 ] || dry_run=yes ;;
  *) fail "unknown mode" ;;
esac
valid_sha "$wanted" || fail "release SHA must be full lowercase SHA"
root="${VOLLEYTIME_ROOT:-/opt/volleytime}"
helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$root"
[ -f .env ] && [ -f docker-compose.prod.yml ] || fail "production env or Compose file is missing"
[ -d .deploy ] || install -d -m 700 .deploy
exec 9>.deploy/image-bundle.lock
if ! flock -n 9; then
  # Retention runs after a successful release; it never fails the deploy.
  [ "$mode" != prune-retained ] || { echo 'image-bundle prune: warning: another activation holds the lock; nothing removed' >&2; exit 0; }
  fail "another activation holds the lock"
fi

phase_file=.deploy/image-bundle-phase
manifest=.env.images
previous_manifest=.env.images.previous
previous_pointer=.deploy/previous-git-sha
previous_env=".deploy/previous-env-$wanted"
compose=(docker compose -f docker-compose.prod.yml -f "$helper_dir/compose-images-only.yml" --env-file .env --env-file .env.images)
health_url="${PUBLIC_HEALTH_URL:-https://volleytime.by/api/health}"

mark() {
  local temp
  temp="$(mktemp .deploy/.image-bundle-phase.XXXXXX)"
  printf '%s %s\n' "$1" "$wanted" > "$temp"
  chmod 600 "$temp"
  mv -f "$temp" "$phase_file"
  echo "image-bundle phase: $1 $wanted"
}

write_manifest() {
  local sha="$1" destination="$2" temp
  temp="$(mktemp "${destination}.XXXXXX")"
  printf 'WEB_IMAGE=volleytime-web:%s\nBOT_IMAGE=volleytime-bot:%s\nMIGRATOR_IMAGE=volleytime-migrator:%s\nRELEASE_VERSION=%s\n' "$sha" "$sha" "$sha" "$sha" > "$temp"
  chmod 600 "$temp"
  mv -f "$temp" "$destination"
}

read_manifest_sha() {
  local path="$1" sha web prefix
  [ -f "$path" ] || return 1
  sha="$(sed -n 's/^RELEASE_VERSION=//p' "$path")"
  valid_sha "$sha" || return 1
  web="$(sed -n 's/^WEB_IMAGE=//p' "$path")"
  if [ "$web" = "volleytime-web:$sha" ]; then
    prefix=volleytime-
  elif [[ "$web" =~ ^(ghcr\.io/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/)web:$sha$ ]]; then
    prefix="${BASH_REMATCH[1]}"
  else
    return 1
  fi
  [ "$(cat "$path")" = "$(printf 'WEB_IMAGE=%sweb:%s\nBOT_IMAGE=%sbot:%s\nMIGRATOR_IMAGE=%smigrator:%s\nRELEASE_VERSION=%s' "$prefix" "$sha" "$prefix" "$sha" "$prefix" "$sha" "$sha")" ] || return 1
  printf '%s' "$sha"
}

inspect_runtime() {
  local service="$1" identity running healthy image sha
  identity="$(docker inspect --format '{{.State.Running}}|{{.State.Health.Status}}|{{.Config.Image}}' "vt_$service")" || return "$?"
  IFS='|' read -r running healthy image <<< "$identity"
  [ "$running" = true ] && [ "$healthy" = healthy ] || return 1
  [[ "$image" =~ ^(volleytime-|ghcr\.io/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/)$service:([0-9a-f]{40})$ ]] || return 1
  sha="${BASH_REMATCH[2]}"
  printf '%s' "$sha"
}

inspect_runtime_tag() {
  local service="$1" identity image
  identity="$(docker inspect --format '{{.State.Running}}|{{.State.Health.Status}}|{{.Config.Image}}' "vt_$service")" || return "$?"
  IFS='|' read -r _running _healthy image <<< "$identity"
  [[ "$image" =~ ^(volleytime-|ghcr\.io/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/)$service:([0-9a-f]{40})$ ]] || return 1
  printf '%s' "${BASH_REMATCH[2]}"
}

check_json_health() {
  local body="$1" sha="$2" kind="$3"
  printf '%s' "$body" | "${PYTHON_BIN:-python3}" -c '
import json, sys
try:
    data = json.load(sys.stdin)
    good = data.get("status") == "ok" and data.get("release") == sys.argv[1]
    if sys.argv[2] == "web":
        good = good and data.get("db") == "ok" and data.get("auth") == "ok"
    sys.exit(0 if good else 1)
except (ValueError, TypeError, AttributeError):
    sys.exit(1)
' "$sha" "$kind"
}

check_health() {
  local sha="$1" web bot db public bot_body
  web="$(inspect_runtime web)" || return "$?"
  bot="$(inspect_runtime bot)" || return "$?"
  [ "$web" = "$sha" ] && [ "$bot" = "$sha" ] || return 1
  db="$(docker inspect --format '{{.State.Running}}|{{.State.Health.Status}}' vt_postgres)" || return "$?"
  [[ "$db" = true\|healthy* ]] || return 1
  bot_body="$(docker exec vt_bot wget -qO- http://127.0.0.1:3001/healthz)" || return "$?"
  check_json_health "$bot_body" "$sha" bot || return "$?"
  public="$("${CURL_BIN:-curl}" --fail --silent --show-error --max-time 10 "$health_url")" || return "$?"
  check_json_health "$public" "$sha" web
}

wait_health() {
  local sha="$1" attempts="${HEALTH_ATTEMPTS:-12}" delay="${HEALTH_SLEEP_SECONDS:-5}" n result
  [[ "$attempts" =~ ^[1-9][0-9]?$ ]] || fail "invalid health attempt count"
  [[ "$delay" =~ ^[0-9]{1,2}$ ]] || fail "invalid health retry delay"
  for ((n = 1; n <= attempts; n++)); do
    if check_health "$sha"; then return 0; else
      result=$?
      case "$result" in 124|137|143|255) return "$result" ;; esac
    fi
    if [ "$n" -lt "$attempts" ]; then sleep "$delay" || return "$?"; fi
  done
  return 1
}

images_available() {
  local path="$1" service image
  read_manifest_sha "$path" >/dev/null || return 1
  for service in WEB BOT MIGRATOR; do
    image="$(sed -n "s/^${service}_IMAGE=//p" "$path")"
    docker image inspect "$image" >/dev/null 2>&1 || return "$?"
  done
}

copy_manifest() {
  local temp
  temp="$(mktemp .deploy/.image-manifest.XXXXXX)"
  install -m 600 "$1" "$temp" && mv -f "$temp" "$2"
}

interrupted() {
  case "$1" in
    124|137|143|255)
      mark interrupted
      echo 'image-bundle: operation interrupted; manual recovery checkpoint' >&2
      exit "$1" ;;
  esac
}

operation_failed() {
  interrupted "$1"
  fail "$2"
}

clean_prod() {
  [ "$(git branch --show-current)" = prod ] &&
    [ -z "$(git status --porcelain --untracked-files=no)" ]
}

capture_previous() {
  local web bot old_manifest old_pointer path service image identity
  web="$(inspect_runtime web)" && bot="$(inspect_runtime bot)" || operation_failed "$?" "live web/bot are not healthy SHA images"
  [ "$web" = "$bot" ] || fail "live web/bot SHA mismatch"
  check_health "$web" || operation_failed "$?" "live web/bot/public health does not match runtime SHA"
  path="$manifest"
  old_manifest="$(read_manifest_sha "$manifest" || true)"
  old_pointer="$(cat "$previous_pointer" 2>/dev/null || true)"
  if [ "$old_manifest" != "$web" ]; then
    [ "$old_pointer" = "$web" ] || fail "candidate manifest and previous pointer cannot explain live runtime"
    [ "$(read_manifest_sha "$previous_manifest" || true)" = "$web" ] || fail "previous manifest does not match live runtime"
    path="$previous_manifest"
  fi
  for service in web bot; do
    image="$(sed -n "s/^${service^^}_IMAGE=//p" "$path")"
    identity="$(docker inspect --format '{{.State.Running}}|{{.State.Health.Status}}|{{.Config.Image}}' "vt_$service")" || operation_failed "$?" "live image unavailable"
    [ "$identity" = "true|healthy|$image" ] || fail "live image reference differs from manifest"
  done
  images_available "$path" || operation_failed "$?" "old runtime images are unavailable"
  if [ "$old_manifest" != "$web" ]; then
    bash "$helper_dir/verify-live-rollback-env.sh" "$path" || fail "rollback env does not match live runtime"
  fi
  printf '%s' "$web"
}

check_ghcr_checkpoint() {
  [ -f .deploy/ghcr-manual-phase ] || return 0
  local ghcr_phase ghcr_sha checkout_sha image_phase image_sha old_snapshot history_snapshot old path confirmed
  read -r ghcr_phase ghcr_sha < .deploy/ghcr-manual-phase || fail "GHCR checkpoint is unreadable"
  valid_sha "$ghcr_sha" && [ "$(cat .deploy/ghcr-manual-phase)" = "$ghcr_phase $ghcr_sha" ] || fail "GHCR checkpoint is invalid"
  case "$ghcr_phase" in activated|rolled-back) ;; *) fail "unfinished GHCR phase $ghcr_phase for $ghcr_sha" ;; esac
  clean_prod || fail "GHCR checkpoint has dirty or non-prod checkout"
  checkout_sha="$(git rev-parse HEAD)"
  git cat-file -e "$ghcr_sha^{commit}" || fail "GHCR checkpoint commit is unavailable"
  if [ "$ghcr_phase" = rolled-back ]; then
    old_snapshot=".deploy/ghcr-old-manifest-$ghcr_sha"
    history_snapshot=".deploy/ghcr-history-$ghcr_sha"
    old="$(read_manifest_sha "$old_snapshot")" || fail "GHCR rollback snapshot is invalid"
    [ -d "$history_snapshot" ] || fail "GHCR rollback history is missing"
    [ "$old" != "$ghcr_sha" ] && git merge-base --is-ancestor "$old" "$ghcr_sha" || fail "GHCR rollback snapshot is not an ancestor"
  fi
  # An accepted later image release explains a completed historical GHCR marker.
  # Never infer completion for an unfinished GHCR attempt from healthy old images.
  if [ -f "$phase_file" ] && [ "$ghcr_sha" != "$checkout_sha" ]; then
    read -r image_phase image_sha < "$phase_file" || fail "image phase is unreadable"
    if [ "$image_phase" = smoke-passed ] && [ "$image_sha" = "$checkout_sha" ] &&
      git merge-base --is-ancestor "$ghcr_sha" "$checkout_sha"; then
      [ "$(read_manifest_sha "$manifest" || true)" = "$checkout_sha" ] || fail "completed image phase disagrees with manifest"
      confirmed="$(capture_previous)" || exit "$?"
      [ "$confirmed" = "$checkout_sha" ] || fail "completed image phase disagrees with runtime"
      return 0
    fi
  fi
  if [ "$ghcr_phase" = activated ]; then
    [ "$ghcr_sha" = "$checkout_sha" ] || fail "GHCR handoff phase disagrees with checkout"
    [[ "$(sed -n 's/^WEB_IMAGE=//p' "$manifest")" == ghcr.io/* ]] || fail "GHCR handoff requires a GHCR manifest"
  else
    [ "$old" = "$checkout_sha" ] && cmp -s "$old_snapshot" "$manifest" || fail "GHCR rollback snapshot disagrees with checkout or manifest"
    for path in "$previous_manifest" "$previous_pointer"; do
      if [ -f "$history_snapshot/$(basename "$path")" ]; then
        cmp -s "$history_snapshot/$(basename "$path")" "$path" || fail "GHCR rollback history was not restored"
      else
        [ ! -e "$path" ] || fail "GHCR rollback history was not restored"
      fi
    done
  fi
  [ "$(read_manifest_sha "$manifest" || true)" = "$checkout_sha" ] || fail "GHCR checkpoint disagrees with manifest"
  confirmed="$(capture_previous)" || exit "$?"
  [ "$confirmed" = "$checkout_sha" ] || fail "GHCR checkpoint disagrees with runtime"
}

rollback_to_previous() {
  local candidate="$1" old="$2" switch_started="${3:-yes}" old_web old_bot recovery_state captured
  valid_sha "$old" || fail "previous SHA is not validated"
  [ "$(read_manifest_sha "$previous_manifest" || true)" = "$old" ] || fail "previous manifest mismatch"
  [ "$(cat "$previous_pointer" 2>/dev/null || true)" = "$old" ] || fail "previous pointer mismatch"
  [ -f "$previous_env" ] || fail "previous production env is unavailable"
  images_available "$previous_manifest" || operation_failed "$?" "old images are missing; no automatic rollback"
  clean_prod || fail "checkout is dirty or not prod; no automatic rollback"
  [ "$(git rev-parse HEAD)" = "$candidate" ] || fail "checkout is not expected candidate; no automatic rollback"
  git cat-file -e "$old^{commit}" || fail "previous Git commit unavailable"
  git merge-base --is-ancestor "$old" "$candidate" || fail "previous Git commit is not ancestor"
  old_web="$(inspect_runtime_tag web)" || operation_failed "$?" "web runtime identity is unavailable"
  old_bot="$(inspect_runtime_tag bot)" || operation_failed "$?" "bot runtime identity is unavailable"
  for image_sha in "$old_web" "$old_bot"; do
    [ "$image_sha" = "$old" ] || [ "$image_sha" = "$candidate" ] || fail "runtime identity is ambiguous; no automatic rollback"
  done
  recovery_state="$(mktemp -d .deploy/.split-recovery.XXXXXX)"
  captured="$recovery_state/runtime"
  install -m 600 .env "$recovery_state/env"
  install -m 600 "$manifest" "$recovery_state/manifest"
  printf '%s\n' "$candidate" > "$recovery_state/git-sha"
  # Guard captures ACTUAL current IDs/images, including partially activated candidates.
  if bash "$helper_dir/verify-split-rollback.sh" "$(sed -n 's/^WEB_IMAGE=//p' "$previous_manifest")" "$(sed -n 's/^BOT_IMAGE=//p' "$previous_manifest")" "$captured"; then :; else
    mark rollback-denied
    fail "split compatibility guard denied downgrade; Git=$candidate, manifest/env unchanged, captured=$captured"
  fi
  recover_captured_current() {
    local reason="$1"
    # No unsafe fallback: restore the exact boundary source/config, then start
    # only still-existing, verified captured compatible current container IDs.
    git reset --hard "$candidate" >/dev/null &&
      copy_manifest "$recovery_state/manifest" "$manifest" &&
      install -m 600 "$recovery_state/env" .env &&
      bash "$helper_dir/verify-split-rollback.sh" recover "$captured" || {
        mark rollback-recovery-failed
        fail "$reason; captured recovery unconfirmed; Git=$(git rev-parse HEAD), manifest=$manifest, env=.env, snapshot=$recovery_state; reviewed roll-forward required"
      }
    mark rollback-denied
    fail "$reason; captured current restored; Git=$candidate, manifest/env restored from $recovery_state; review runtime health before roll-forward"
  }
  bash "$helper_dir/verify-split-rollback.sh" recheck "$captured" || recover_captured_current "writer recheck failed"
  mark rollback-started
  git reset --hard "$old" >/dev/null || recover_captured_current "Git rollback failed"
  copy_manifest "$previous_manifest" "$manifest" || recover_captured_current "manifest rollback failed"
  install -m 600 "$previous_env" .env || recover_captured_current "env rollback failed"
  bash "$helper_dir/verify-split-rollback.sh" recheck "$captured" || recover_captured_current "writer recheck failed before activation"
  if [ "$switch_started" = no ]; then
    bash "$helper_dir/verify-split-rollback.sh" recover "$captured" || recover_captured_current "unchanged runtime restart failed"
  else
    "${compose[@]}" up --no-build -d web bot || recover_captured_current "old application activation failed"
  fi
  wait_health "$old" || recover_captured_current "old release health failed after rollback"
  mark rolled-back
}

# --- Planned release retention (Task 9.8.18) ---------------------------------
# Successful releases, oldest first; appended only by confirm-smoke.
release_history=.deploy/release-history
retain_pins=.deploy/retain-pins
retain_count_file=.deploy/retain-releases
release_image_re='^volleytime-(web|bot|migrator):([0-9a-f]{40})$'

record_release_history() {
  local temp
  if [ -f "$release_history" ] && grep -qxF "$wanted" "$release_history"; then return 0; fi
  temp="$(mktemp .deploy/.release-history.XXXXXX)" || return 1
  # awk 1 restores a missing final newline of a hand-seeded file.
  if { if [ -f "$release_history" ]; then awk 1 "$release_history"; fi; printf '%s\n' "$wanted"; } > "$temp" &&
    chmod 600 "$temp" && mv -f "$temp" "$release_history"; then
    return 0
  fi
  rm -f -- "$temp"
  return 1
}

prune_log() { echo "image-bundle prune: $*"; }
prune_skip() { echo "image-bundle prune: warning: $*; nothing removed" >&2; }

report_free_space() {
  local label="$1" path docker_root
  docker_root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
  for path in "$root" "$docker_root"; do
    [ -n "$path" ] && [ -d "$path" ] || continue
    df -Pk "$path" 2>/dev/null | awk -v label="$label" -v path="$path" \
      'NR == 2 { printf "image-bundle prune: free %s: %s %s KiB available of %s KiB\n", label, path, $4, $2 }' || true
  done
}

# Prints the keep set as "SHA reason" lines (one per reason) or fails closed.
retained_releases() {
  local phase="" phase_sha="" current previous count line sha entry snapshot
  local -a history=()
  if [ -f "$phase_file" ]; then read -r phase phase_sha < "$phase_file" || true; fi
  [ "$phase $phase_sha" = "smoke-passed $wanted" ] || { prune_skip "phase is not smoke-passed $wanted"; return 1; }
  current="$(read_manifest_sha "$manifest" || true)"
  [ "$current" = "$wanted" ] && [ "$(git rev-parse HEAD 2>/dev/null || true)" = "$wanted" ] ||
    { prune_skip "current release cannot be determined from manifest and checkout"; return 1; }
  [ "$(inspect_runtime web 2>/dev/null || true)" = "$wanted" ] && [ "$(inspect_runtime bot 2>/dev/null || true)" = "$wanted" ] ||
    { prune_skip "live web/bot do not run the current release"; return 1; }
  previous="$(cat "$previous_pointer" 2>/dev/null || true)"
  valid_sha "$previous" && [ "$(read_manifest_sha "$previous_manifest" || true)" = "$previous" ] ||
    { prune_skip "previous release cannot be determined from pointer and manifest"; return 1; }
  count=3
  if [ -f "$retain_count_file" ]; then count="$(tr -d '[:space:]' < "$retain_count_file")"; fi
  [[ "$count" =~ ^[1-9][0-9]?$ ]] || { prune_skip "$retain_count_file must hold a release count 1-99"; return 1; }
  if [ -f "$release_history" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      [ -n "$line" ] || continue
      valid_sha "$line" || { prune_skip "$release_history has a malformed line"; return 1; }
      history+=("$line")
    done < "$release_history"
  fi
  [ "${#history[@]}" -ge "$count" ] ||
    { prune_skip "$release_history records ${#history[@]} of $count successful releases"; return 1; }
  printf '%s current\n%s previous\n' "$wanted" "$previous"
  for entry in "${history[@]: -$count}"; do printf '%s recent\n' "$entry"; done
  if [ -f "$retain_pins" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line%%#*}"
      read -r sha entry <<< "$line" || true
      [ -n "$sha" ] || continue
      valid_sha "$sha" && [ -z "$entry" ] || { prune_skip "$retain_pins must list one full SHA per line"; return 1; }
      printf '%s pinned\n' "$sha"
    done < "$retain_pins"
  fi
  for snapshot in .deploy/.split-recovery.*; do
    [ -d "$snapshot" ] || continue
    if [ -f "$snapshot/manifest" ]; then
      sha="$(read_manifest_sha "$snapshot/manifest")" || { prune_skip "recovery snapshot $snapshot has an unreadable manifest"; return 1; }
      printf '%s recovery\n' "$sha"
    fi
    if [ -f "$snapshot/git-sha" ]; then
      sha="$(tr -d '[:space:]' < "$snapshot/git-sha")"
      valid_sha "$sha" || { prune_skip "recovery snapshot $snapshot has an invalid Git SHA"; return 1; }
      printf '%s recovery\n' "$sha"
    fi
  done
  # Any container, running or stopped, pins its whole release.
  local containers
  containers="$(docker container ls --all --format '{{.Image}}')" || { prune_skip "cannot list containers"; return 1; }
  while IFS= read -r line; do
    if [[ "$line" =~ $release_image_re ]]; then printf '%s in-use\n' "${BASH_REMATCH[2]}"; fi
  done <<< "$containers"
}

prune_retained() {
  local keep_lines images line sha ref dir removed_images=0 removed_dirs=0 failures=0
  local -A keep=() failed=()
  local -a order=() remove_refs=() remove_dirs=()
  report_free_space before
  keep_lines="$(retained_releases)" || return 0
  while read -r sha line; do
    if [ -z "${keep[$sha]:-}" ]; then order+=("$sha"); keep[$sha]="$line"
    else case ",${keep[$sha]}," in *",$line,"*) ;; *) keep[$sha]="${keep[$sha]},$line" ;; esac; fi
  done <<< "$keep_lines"
  for sha in "${order[@]}"; do prune_log "keep $sha (${keep[$sha]})"; done
  images="$(docker image ls --format '{{.Repository}}:{{.Tag}}')" || { prune_skip "cannot list images"; return 0; }
  # Only exact SHA tags of our three services that are older releases on prod.
  while IFS= read -r ref; do
    [[ "$ref" =~ $release_image_re ]] || continue
    sha="${BASH_REMATCH[2]}"
    [ -z "${keep[$sha]:-}" ] || continue
    if [ "$sha" != "$wanted" ] && git merge-base --is-ancestor "$sha" "$wanted" 2>/dev/null; then
      remove_refs+=("$ref")
    else
      prune_log "leave $ref (not an older release of prod)"
    fi
  done <<< "$images"
  for dir in .deploy/incoming/*; do
    sha="${dir##*/}"
    valid_sha "$sha" && [ -d "$dir" ] && [ ! -L "$dir" ] || continue
    [ -z "${keep[$sha]:-}" ] || continue
    if [ "$sha" != "$wanted" ] && git merge-base --is-ancestor "$sha" "$wanted" 2>/dev/null; then
      remove_dirs+=("$dir")
    else
      prune_log "leave staging $dir (not an older release of prod)"
    fi
  done
  for ref in "${remove_refs[@]}"; do
    if [ "$dry_run" = yes ]; then prune_log "would remove image $ref"; continue; fi
    # No -f: Docker itself refuses to untag an image that a container uses.
    if docker image rm "$ref" >/dev/null; then
      removed_images=$((removed_images + 1)); prune_log "removed image $ref"
    else
      failures=$((failures + 1)); failed[${ref##*:}]=1
      echo "image-bundle prune: warning: failed to remove image $ref; its release staging is kept" >&2
    fi
  done
  for dir in "${remove_dirs[@]}"; do
    if [ "$dry_run" = yes ]; then prune_log "would remove staging $dir"; continue; fi
    [ -z "${failed[${dir##*/}]:-}" ] || { prune_log "keep staging $dir (image removal failed)"; continue; }
    if rm -rf -- "$dir"; then
      removed_dirs=$((removed_dirs + 1)); prune_log "removed staging $dir"
    else
      failures=$((failures + 1)); echo "image-bundle prune: warning: failed to remove staging $dir" >&2
    fi
  done
  report_free_space after
  if [ "$dry_run" = yes ]; then
    prune_log "dry run: ${#remove_refs[@]} images and ${#remove_dirs[@]} staging directories would be removed"
  else
    prune_log "removed $removed_images images, $removed_dirs staging directories, $failures failures"
  fi
}

if [ "$mode" = prune-retained ]; then
  prune_retained || echo 'image-bundle prune: warning: retention stopped early' >&2
  exit 0
fi

if [ "$mode" = rollback ]; then
  [ -f "$phase_file" ] || fail "activation phase is unknown"
  read -r phase phase_sha < "$phase_file"
  [ "$phase_sha" = "$wanted" ] || fail "activation phase belongs to another SHA"
  case "$phase" in activated|smoke-passed) ;; *) fail "activation phase is not eligible for rollback" ;; esac
  previous="$(cat "$previous_pointer" 2>/dev/null || true)"
  rollback_to_previous "$wanted" "$previous"
  exit 0
fi

if [ "$mode" = confirm-smoke ]; then
  [ -f "$phase_file" ] || fail "activation phase is unknown"
  read -r phase phase_sha < "$phase_file"
  [ "$phase_sha" = "$wanted" ] || fail "activation phase belongs to another SHA"
  case "$phase" in activated|smoke-passed) ;; *) fail "activation has not completed" ;; esac
  clean_prod || fail "checkout is dirty or not prod"
  [ "$(git rev-parse HEAD)" = "$wanted" ] || fail "checkout does not match synthetic smoke SHA"
  [ "$(read_manifest_sha "$manifest" || true)" = "$wanted" ] || fail "manifest does not match synthetic smoke SHA"
  check_health "$wanted" || operation_failed "$?" "runtime no longer matches synthetic smoke SHA"
  mark smoke-passed
  record_release_history || echo "image-bundle: warning: $release_history was not updated" >&2
  exit 0
fi

[ -d "$staging" ] && [ -f "$staging/release.bundle" ] || fail "staged Git bundle is missing"
[ -s "$staging/.env.production" ] || fail "staged production env is missing"
check_ghcr_checkpoint
if [ -f "$phase_file" ]; then
  read -r phase phase_sha < "$phase_file"
  if [ "$phase" = smoke-passed ]; then
    clean_prod || fail "successful phase has dirty or non-prod checkout"
    accepted_sha="$phase_sha"
    checkout_sha="$(git rev-parse HEAD)"
    if [ "$checkout_sha" != "$phase_sha" ]; then
      # A completed image release may be followed by a manual GHCR release.
      # Only that explicit, healthy and ancestral handoff explains a stale
      # completed marker; unfinished image/GHCR phases remain ineligible.
      valid_sha "$phase_sha" || fail "successful phase SHA is invalid"
      [ -f .deploy/ghcr-manual-phase ] || fail "successful phase disagrees with checkout"
      # check_ghcr_checkpoint already proved completed state and exact runtime.
      git cat-file -e "$phase_sha^{commit}" || fail "previous successful image commit is unavailable"
      git merge-base --is-ancestor "$phase_sha" "$checkout_sha" || fail "GHCR handoff is not a descendant of the successful image release"
      accepted_sha="$checkout_sha"
    fi
    [ "$(read_manifest_sha "$manifest" || true)" = "$accepted_sha" ] || fail "successful phase disagrees with manifest"
    confirmed="$(capture_previous)"
    [ "$confirmed" = "$accepted_sha" ] || fail "successful phase disagrees with runtime"
    if [ "$phase_sha" = "$wanted" ]; then
      [ "$accepted_sha" = "$wanted" ] || fail "requested release is no longer current after GHCR handoff"
      exit 0
    fi
  else
    [ "$phase_sha" = "$wanted" ] || fail "unfinished activation belongs to another SHA"
    case "$phase" in
      verified|loaded)
        # These phases precede backup and checkout mutation. HEAD/manifest may
        # already equal the target in the documented partial-deploy incident.
        # The live runtime and previous pointer must still agree before retry.
        capture_previous >/dev/null
        ;;
      *) fail "unfinished activation phase $phase for $phase_sha" ;;
    esac
  fi
fi

clean_prod || fail "tracked checkout is dirty or branch is not prod"
bash "$helper_dir/release-bundle.sh" verify --repo "$root" --bundle "$staging/release.bundle" --expected "$wanted" || fail "Git bundle verification failed"
ref="$(git bundle list-heads "$staging/release.bundle" | awk -v sha="$wanted" '$1 == sha {print $2; exit}')"
[ -n "$ref" ] || fail "bundle does not advertise expected commit"
git fetch --no-tags "$staging/release.bundle" "$ref" >/dev/null || fail "bundle fetch failed"
[ "$(git rev-parse FETCH_HEAD)" = "$wanted" ] || fail "bundle fetched wrong commit"
git merge-base --is-ancestor HEAD FETCH_HEAD || fail "bundle target is not fast-forward"
previous="$(capture_previous)"
git cat-file -e "$previous^{commit}" || fail "previous runtime Git commit is unavailable"
git merge-base --is-ancestor "$previous" "$wanted" || fail "previous runtime Git commit is not an ancestor"
if [ "$previous" = "$wanted" ]; then
  fail "target is already live without completed phase; inspect manually"
fi
mark verified
bash "$helper_dir/verify-release-images.sh" "$staging" "$wanted" || fail "image verification/load failed"
mark loaded
confirmed="$(capture_previous)"
[ "$confirmed" = "$previous" ] || fail "live runtime changed while loading images"

# Preserve every pre-existing backup during this activation. The helper still
# validates the new pg_dump/gzip; its normal retention runs outside deploy.
LOCAL_BACKUP_KEEP=2147483647 bash "$helper_dir/backup-local.sh" || fail "backup failed before advancement"
mark backed-up
[ ! -e "$previous_env" ] || fail "previous production env snapshot already exists"
install -m 600 .env "$previous_env" || fail "previous production env snapshot failed"
if [ "$(git rev-parse HEAD)" != "$wanted" ]; then
  bash "$helper_dir/release-bundle.sh" advance --repo "$root" --bundle "$staging/release.bundle" --expected "$wanted" || fail "Git advancement failed"
fi
[ "$(git rev-parse HEAD)" = "$wanted" ] || fail "Git advancement did not reach exact SHA"
if [ "$(read_manifest_sha "$manifest" || true)" = "$previous" ]; then
  copy_manifest "$manifest" "$previous_manifest"
fi
pointer_temp="$(mktemp .deploy/.previous-git-sha.XXXXXX)"
printf '%s\n' "$previous" > "$pointer_temp"
chmod 600 "$pointer_temp"
mv -f "$pointer_temp" "$previous_pointer"
write_manifest "$wanted" "$manifest"
env_temp="$(mktemp .deploy/.env.install.XXXXXX)"
if ! install -m 600 "$staging/.env.production" "$env_temp"; then
  rm -f -- "$env_temp"
  fail "candidate production env staging failed"
fi
if ! mv -f "$env_temp" .env; then
  rm -f -- "$env_temp"
  fail "candidate production env install failed"
fi

if "${compose[@]}" run --rm --no-deps --pull never migrate; then :; else
  result=$?
  interrupted "$result"
  mark migration-failed
  rollback_to_previous "$wanted" "$previous" no
  fail "migration failed; source and manifest restored"
fi
mark migrated
if "${compose[@]}" up --no-build -d web bot; then :; else
  result=$?
  interrupted "$result"
  rollback_to_previous "$wanted" "$previous"
  fail "activation failed; previous release restored"
fi
mark activated
if wait_health "$wanted"; then :; else
  result=$?
  interrupted "$result"
  rollback_to_previous "$wanted" "$previous"
  fail "smoke failed; previous release restored"
fi
echo "image-bundle runtime healthy $wanted; external synthetic smoke pending"
