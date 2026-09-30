#!/usr/bin/env bash
set -euo pipefail

fail() { echo "GHCR manual deploy: $*; manual recovery checkpoint" >&2; exit 1; }
operation_failed() {
  case "$1" in
    124 | 137 | 143 | 255) echo "GHCR manual deploy: $2 was interrupted; manual recovery checkpoint" >&2; exit "$1" ;;
    *) fail "$2" ;;
  esac
}
root="${VOLLEYTIME_ROOT:-/opt/volleytime}"
cd "$root"
[ -f .env.images ] || fail "current image manifest is missing"
[ -f .env ] || fail "current production env is missing"
if [ "${GHCR_REQUIRE_STAGED_ENV:-1}" = 1 ]; then
  staged_env="${GHCR_STAGED_ENV:-.deploy/.env.production}"
  [ -f "$staged_env" ] || fail "staged production env is missing"
  cmp -s .env "$staged_env" || fail "GHCR manual deploy cannot change production env"
fi

declare -A fields=()
count=0
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^(WEB_IMAGE|BOT_IMAGE|MIGRATOR_IMAGE|RELEASE_VERSION)=([^[:space:]]+)$ ]] || fail "invalid current image manifest"
  key="${BASH_REMATCH[1]}"
  [ ! -v "fields[$key]" ] || fail "duplicate current image field"
  fields[$key]="${BASH_REMATCH[2]}"
  count=$((count + 1))
done < .env.images
[ "$count" -eq 4 ] || fail "incomplete current image manifest"
sha="${fields[RELEASE_VERSION]}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || fail "invalid current release SHA"

for service in web bot migrator; do
  key="${service^^}_IMAGE"
  image="${fields[$key]}"
  [[ "$image" == *":$sha" ]] || fail "$service image tag disagrees with release SHA"
  docker image inspect "$image" >/dev/null 2>&1 || operation_failed "$?" "$service image is unavailable locally"
  if [ "$service" != migrator ]; then
    identity="$(docker inspect --format '{{.State.Running}}|{{.State.Health.Status}}|{{.Config.Image}}' "vt_$service")" || operation_failed "$?" "$service runtime is unavailable"
    [ "$identity" = "true|healthy|$image" ] || fail "$service runtime disagrees with current manifest"
  fi
done

health_url="${PUBLIC_HEALTH_URL:-https://volleytime.by/api/health}"
health="$("${CURL_BIN:-curl}" --fail --silent --show-error --max-time 10 "$health_url")" || operation_failed "$?" "public health is unavailable"
printf '%s' "$health" | "${PYTHON_BIN:-python3}" -c '
import json, sys
try:
    body = json.load(sys.stdin)
    valid = (body.get("status") == "ok" and body.get("db") == "ok"
             and body.get("auth") == "ok" and body.get("release") == sys.argv[1])
    sys.exit(0 if valid else 1)
except (ValueError, TypeError, AttributeError):
    sys.exit(1)
' "$sha" || operation_failed "$?" "public health disagrees with current manifest"

echo "GHCR manual deploy current runtime verified: $sha"
