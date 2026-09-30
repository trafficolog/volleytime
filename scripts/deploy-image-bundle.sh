#!/usr/bin/env bash
set -euo pipefail
umask 077

fail() { echo "image-bundle: $*; manual recovery checkpoint" >&2; exit 1; }
valid_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }

[ "$#" -ge 2 ] || fail "usage: deploy-image-bundle.sh deploy STAGING_DIR FULL_SHA | rollback FULL_SHA | confirm-smoke FULL_SHA"
mode="$1"
case "$mode" in
  deploy) [ "$#" -eq 3 ] || fail "deploy needs staging directory and full SHA"; staging="$2"; wanted="$3" ;;
  rollback) [ "$#" -eq 2 ] || fail "rollback needs full SHA"; wanted="$2" ;;
  confirm-smoke) [ "$#" -eq 2 ] || fail "confirm-smoke needs full SHA"; wanted="$2" ;;
  *) fail "unknown mode" ;;
esac
valid_sha "$wanted" || fail "release SHA must be full lowercase SHA"
root="${VOLLEYTIME_ROOT:-/opt/volleytime}"
helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$root"
[ -f .env ] && [ -f docker-compose.prod.yml ] || fail "production env or Compose file is missing"
[ -d .deploy ] || install -d -m 700 .deploy
exec 9>.deploy/image-bundle.lock
flock -n 9 || fail "another activation holds the lock"

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
  local candidate="$1" old="$2" old_web old_bot
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
  mark rollback-started
  git reset --hard "$old" >/dev/null || fail "Git rollback failed"
  copy_manifest "$previous_manifest" "$manifest"
  install -m 600 "$previous_env" .env || fail "previous production env restore failed"
  "${compose[@]}" up --no-build -d web bot || { result=$?; interrupted "$result"; fail "old application restart failed"; }
  wait_health "$old" || { result=$?; interrupted "$result"; fail "old release health failed after rollback"; }
  mark rolled-back
}

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
  # No application switch occurred; restore source and manifest only.
  clean_prod || fail "migration failed and checkout is ambiguous"
  git reset --hard "$previous" >/dev/null || fail "migration failed and Git rollback failed"
  copy_manifest "$previous_manifest" "$manifest"
  install -m 600 "$previous_env" .env || fail "migration failed and previous production env restore failed"
  check_health "$previous" || operation_failed "$?" "migration failed and previous runtime health is not exact"
  mark rolled-back
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
