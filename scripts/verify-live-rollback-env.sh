#!/usr/bin/env bash
set -euo pipefail

fail() { echo "rollback env: $*; manual recovery checkpoint" >&2; exit 1; }
[ "$#" -eq 1 ] || fail "previous manifest is required"
root="${VOLLEYTIME_ROOT:-/opt/volleytime}"
cd "$root"
manifest="$1"
[ -f .env ] && [ -f "$manifest" ] || fail "configuration is missing"
sha="$(sed -n 's/^RELEASE_VERSION=//p' "$manifest")"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || fail "previous release SHA is invalid"

# Render the previous release, even when checkout already contains a candidate.
# Never persist or print rendered configuration, image defaults or runtime values.
rendered="$(git show "$sha:docker-compose.prod.yml" 2>/dev/null |
  docker compose -f - --project-directory "$root" --env-file .env --env-file "$manifest" config --format json 2>/dev/null)" || fail "previous Compose rendering failed"
web_image="$(sed -n 's/^WEB_IMAGE=//p' "$manifest")"
bot_image="$(sed -n 's/^BOT_IMAGE=//p' "$manifest")"
web_defaults="$(docker image inspect --format '{{json .Config.Env}}' "$web_image" 2>/dev/null)" || fail "web image inspection failed"
bot_defaults="$(docker image inspect --format '{{json .Config.Env}}' "$bot_image" 2>/dev/null)" || fail "bot image inspection failed"
web_live="$(docker inspect --format '{{json .Config.Env}}' vt_web 2>/dev/null)" || fail "web runtime inspection failed"
bot_live="$(docker inspect --format '{{json .Config.Env}}' vt_bot 2>/dev/null)" || fail "bot runtime inspection failed"

printf '[%s,%s,%s,%s,%s]\n' "$rendered" "$web_defaults" "$bot_defaults" "$web_live" "$bot_live" |
  "${PYTHON_BIN:-python3}" -c '
import json, sys

def strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError()
        result[key] = value
    return result

def env_set(entries):
    if not isinstance(entries, list):
        raise ValueError()
    result = {}
    for entry in entries:
        if not isinstance(entry, str) or "=" not in entry:
            raise ValueError()
        key, value = entry.split("=", 1)
        if not key or key in result:
            raise ValueError()
        result[key] = value
    return result

try:
    data = json.load(sys.stdin, object_pairs_hook=strict_object)
    if not isinstance(data, list) or len(data) != 5:
        raise ValueError()
    services = data[0]["services"]
    for service, defaults, live in [("web", data[1], data[3]), ("bot", data[2], data[4])]:
        configured = services[service]["environment"]
        if not isinstance(configured, dict) or any(
            not isinstance(k, str) or not k or "=" in k or not isinstance(v, str)
            for k, v in configured.items()
        ):
            raise ValueError()
        expected = env_set(defaults)
        expected.update(configured)
        actual = env_set(live)
        for values in [expected, actual]:
            values.pop("SMOKE_TG_ID", None)
        if expected.keys() != actual.keys():
            print("rollback env: " + service + " key set mismatch; manual recovery checkpoint", file=sys.stderr)
            sys.exit(1)
        if expected != actual:
            print("rollback env: " + service + " value mismatch; manual recovery checkpoint", file=sys.stderr)
            sys.exit(1)
except (ValueError, TypeError, KeyError, IndexError):
    print("rollback env: invalid configuration JSON; manual recovery checkpoint", file=sys.stderr)
    sys.exit(1)
' || fail "environment comparison failed"
