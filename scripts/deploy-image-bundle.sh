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
compose=(docker compose -f docker-compose.prod.yml --env-file .env --env-file .env.images)
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
  local path="$1" sha
  [ -f "$path" ] || return 1
  sha="$(sed -n 's/^RELEASE_VERSION=//p' "$path")"
  valid_sha "$sha" || return 1
  [ "$(cat "$path")" = "$(printf 'WEB_IMAGE=volleytime-web:%s\nBOT_IMAGE=volleytime-bot:%s\nMIGRATOR_IMAGE=volleytime-migrator:%s\nRELEASE_VERSION=%s' "$sha" "$sha" "$sha" "$sha")" ] || return 1
  printf '%s' "$sha"
}

inspect_runtime() {
  local service="$1" identity running healthy image sha
  identity="$(docker inspect --format '{{.State.Running}}|{{.State.Health.Status}}|{{.Config.Image}}' "vt_$service")" || return 1
  IFS='|' read -r running healthy image <<< "$identity"
  [ "$running" = true ] && [ "$healthy" = healthy ] || return 1
  [[ "$image" =~ ^volleytime-$service:([0-9a-f]{40})$ ]] || return 1
  sha="${BASH_REMATCH[1]}"
  printf '%s' "$sha"
}

inspect_runtime_tag() {
  local service="$1" identity image
  identity="$(docker inspect --format '{{.State.Running}}|{{.State.Health.Status}}|{{.Config.Image}}' "vt_$service")" || return 1
  IFS='|' read -r _running _healthy image <<< "$identity"
  [[ "$image" =~ ^volleytime-$service:([0-9a-f]{40})$ ]] || return 1
  printf '%s' "${BASH_REMATCH[1]}"
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
  web="$(inspect_runtime web)" && bot="$(inspect_runtime bot)" || return 1
  [ "$web" = "$sha" ] && [ "$bot" = "$sha" ] || return 1
  db="$(docker inspect --format '{{.State.Running}}|{{.State.Health.Status}}' vt_postgres)" || return 1
  [[ "$db" = true\|healthy* ]] || return 1
  bot_body="$(docker exec vt_bot wget -qO- http://127.0.0.1:3001/healthz)" || return 1
  check_json_health "$bot_body" "$sha" bot || return 1
  public="$("${CURL_BIN:-curl}" --fail --silent --show-error --max-time 10 "$health_url")" || return 1
  check_json_health "$public" "$sha" web
}

wait_health() {
  local sha="$1" attempts="${HEALTH_ATTEMPTS:-12}" delay="${HEALTH_SLEEP_SECONDS:-5}" n
  [[ "$attempts" =~ ^[1-9][0-9]?$ ]] || fail "invalid health attempt count"
  [[ "$delay" =~ ^[0-9]{1,2}$ ]] || fail "invalid health retry delay"
  for ((n = 1; n <= attempts; n++)); do
    if check_health "$sha"; then return 0; fi
    if [ "$n" -lt "$attempts" ]; then sleep "$delay"; fi
  done
  return 1
}

images_available() {
  local sha="$1" service
  for service in web bot migrator; do
    docker image inspect "volleytime-$service:$sha" >/dev/null 2>&1 || return 1
  done
}

clean_prod() {
  [ "$(git branch --show-current)" = prod ] &&
    [ -z "$(git status --porcelain --untracked-files=no)" ]
}

capture_previous() {
  local web bot old_manifest old_pointer
  web="$(inspect_runtime web)" && bot="$(inspect_runtime bot)" || fail "live web/bot are not healthy SHA images"
  [ "$web" = "$bot" ] || fail "live web/bot SHA mismatch"
  check_health "$web" || fail "live web/bot/public health does not match runtime SHA"
  images_available "$web" || fail "old runtime images are unavailable"
  old_manifest="$(read_manifest_sha "$manifest" || true)"
  old_pointer="$(cat "$previous_pointer" 2>/dev/null || true)"
  if [ "$old_manifest" != "$web" ]; then
    [ "$old_pointer" = "$web" ] || fail "candidate manifest and previous pointer cannot explain live runtime"
    [ "$(read_manifest_sha "$previous_manifest" || true)" = "$web" ] || fail "previous manifest does not match live runtime"
  fi
  printf '%s' "$web"
}

rollback_to_previous() {
  local candidate="$1" old="$2" old_web old_bot
  valid_sha "$old" || fail "previous SHA is not validated"
  [ "$(read_manifest_sha "$previous_manifest" || true)" = "$old" ] || fail "previous manifest mismatch"
  [ "$(cat "$previous_pointer" 2>/dev/null || true)" = "$old" ] || fail "previous pointer mismatch"
  [ -f "$previous_env" ] || fail "previous production env is unavailable"
  images_available "$old" || fail "old images are missing; no automatic rollback"
  clean_prod || fail "checkout is dirty or not prod; no automatic rollback"
  [ "$(git rev-parse HEAD)" = "$candidate" ] || fail "checkout is not expected candidate; no automatic rollback"
  git cat-file -e "$old^{commit}" || fail "previous Git commit unavailable"
  git merge-base --is-ancestor "$old" "$candidate" || fail "previous Git commit is not ancestor"
  old_web="$(inspect_runtime_tag web || true)"
  old_bot="$(inspect_runtime_tag bot || true)"
  for image_sha in "$old_web" "$old_bot"; do
    [ "$image_sha" = "$old" ] || [ "$image_sha" = "$candidate" ] || fail "runtime identity is ambiguous; no automatic rollback"
  done
  mark rollback-started
  git reset --hard "$old" >/dev/null || fail "Git rollback failed"
  write_manifest "$old" "$manifest"
  install -m 600 "$previous_env" .env || fail "previous production env restore failed"
  "${compose[@]}" up --no-build -d web bot || fail "old application restart failed"
  wait_health "$old" || fail "old release health failed after rollback"
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
  check_health "$wanted" || fail "runtime no longer matches synthetic smoke SHA"
  mark smoke-passed
  exit 0
fi

[ -d "$staging" ] && [ -f "$staging/release.bundle" ] || fail "staged Git bundle is missing"
[ -s "$staging/.env.production" ] || fail "staged production env is missing"
if [ -f "$phase_file" ]; then
  read -r phase phase_sha < "$phase_file"
  if [ "$phase" = smoke-passed ] && [ "$phase_sha" = "$wanted" ]; then
    [ "$(git rev-parse HEAD)" = "$wanted" ] || fail "successful phase disagrees with checkout"
    check_health "$wanted" || fail "successful phase disagrees with runtime"
    exit 0
  fi
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
[ "$(capture_previous)" = "$previous" ] || fail "live runtime changed while loading images"

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
write_manifest "$previous" "$previous_manifest"
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

if ! "${compose[@]}" run --rm --no-build migrate; then
  mark migration-failed
  # No application switch occurred; restore source and manifest only.
  clean_prod || fail "migration failed and checkout is ambiguous"
  git reset --hard "$previous" >/dev/null || fail "migration failed and Git rollback failed"
  write_manifest "$previous" "$manifest"
  install -m 600 "$previous_env" .env || fail "migration failed and previous production env restore failed"
  check_health "$previous" || fail "migration failed and previous runtime health is not exact"
  mark rolled-back
  fail "migration failed; source and manifest restored"
fi
mark migrated
if ! "${compose[@]}" up --no-build -d web bot; then
  rollback_to_previous "$wanted" "$previous"
  fail "activation failed; previous release restored"
fi
mark activated
if ! wait_health "$wanted"; then
  rollback_to_previous "$wanted" "$previous"
  fail "smoke failed; previous release restored"
fi
echo "image-bundle runtime healthy $wanted; external synthetic smoke pending"
