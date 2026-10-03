#!/usr/bin/env bash
set -euo pipefail
umask 077

# The caller owns fd 9 / image-bundle.lock through guard, switch and recovery.
# Never source this private snapshot: it contains inert, validated identities.
fail() { echo "split rollback: $*; inspect captured runtime, Git, manifest and env; reviewed roll-forward required" >&2; exit 1; }
root="${VOLLEYTIME_ROOT:-/opt/volleytime}"
cd "$root"
{ : >&9; } 2>/dev/null || fail "caller must hold the inherited deploy lock on fd 9"
compose=(docker compose -f docker-compose.prod.yml --env-file .env --env-file .env.images)
network_helper="$(dirname "${BASH_SOURCE[0]}")/capture-split-writer-network.py"
mode=guard
if [ "${1:-}" = recheck ] || [ "${1:-}" = recover ]; then
  [ "$#" -eq 2 ] || fail "mode needs captured runtime file"
  mode="$1"; snapshot="$2"
else
  [ "$#" -eq 3 ] || fail "usage: verify-split-rollback.sh WEB_IMAGE BOT_IMAGE CAPTURED_RUNTIME_FILE"
  web="$1"; bot="$2"; snapshot="$3"
fi

image_identity() {
  local image="$1" service="$2" identity id revision split
  identity="$(docker image inspect --format '{{.Id}}|{{index .Config.Labels "org.opencontainers.image.revision"}}|{{index .Config.Labels "org.volleytime.event-split-pricing"}}' "$image")" || return 1
  IFS='|' read -r id revision split <<< "$identity"
  [[ "$id" =~ ^sha256:[0-9a-f]{64}$ ]] && [[ "$revision" =~ ^[0-9a-f]{40}$ ]] || return 1
  if [[ "$image" != sha256:* ]]; then
    [[ "$image" =~ ^(volleytime-|ghcr\.io/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/)$service:([0-9a-f]{40})$ ]] || return 1
    [ "$revision" = "${BASH_REMATCH[2]}" ] || return 1
  fi
  [ "$split" = 1 ] || split=0
  printf '%s|%s|%s' "$id" "$revision" "$split"
}

writers() {
  local service ids
  for service in web bot; do
    ids="$(docker ps "$@" --no-trunc -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=$service")" || return 1
    [ -z "$ids" ] || printf '%s\n' "$ids"
  done
}
load_snapshot() {
  [ -f "$snapshot" ] || return 1
  read -r project < "$snapshot" || return 1
  [[ "$project" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || return 1
  [ "$(tail -n 1 "$snapshot")" = captured ] || return 1
}
quiescent() {
  local running
  running="$(writers)" || return 1
  [ -z "$running" ]
}
capture_network() {
  local containers network_id inspected
  containers="$(docker inspect vt_postgres "$@")" || return 1
  network_id="$(printf '%s' "$containers" | "${PYTHON_BIN:-python3}" "$network_helper" network-id)" || return 1
  inspected="$(docker network inspect "$network_id")" || return 1
  printf '{"containers":%s,"network":%s}' "$containers" "$inspected" | "${PYTHON_BIN:-python3}" "$network_helper" capture "$project" "$@"
}
drained() {
  local predicate result network_id inspected
  network_id="$("${PYTHON_BIN:-python3}" "$network_helper" network-id "$1")" || return 1
  inspected="$(docker network inspect "$network_id")" || return 1
  predicate="$(printf '%s' "$inspected" | "${PYTHON_BIN:-python3}" "$network_helper" predicate "$1")" || return 1
  # Fresh discovery AFTER stop includes connections opened between capture and stop.
  # PG16's positive timeout waits for each actual backend exit, not signal delivery.
  result="$("${compose[@]}" exec -T postgres psql -U volley -d volleytime -v ON_ERROR_STOP=1 -Atc "SET statement_timeout='30s'; SELECT COALESCE(bool_and(pg_terminate_backend(pid,10000)),true) FROM pg_stat_activity WHERE datname=current_database() AND $predicate AND pid<>pg_backend_pid();")" || return 1
  [ "${result##*$'\n'}" = t ] || return 1
  result="$("${compose[@]}" exec -T postgres psql -U volley -d volleytime -v ON_ERROR_STOP=1 -Atc "SELECT NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND $predicate AND pid<>pg_backend_pid());")" || return 1
  [ "$result" = t ]
}
data_safe() {
  local schema rows
  schema="$("${compose[@]}" exec -T postgres psql -U volley -d volleytime -v ON_ERROR_STOP=1 -Atc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='price_mode');")" || return 2
  case "$schema" in
    f) return 0 ;;
    t) ;;
    *) return 2 ;;
  esac
  rows="$("${compose[@]}" exec -T postgres psql -U volley -d volleytime -v ON_ERROR_STOP=1 -Atc "SELECT EXISTS (SELECT 1 FROM public.events WHERE price_mode='split');")" || return 2
  case "$rows" in f) return 0 ;; t) return 1 ;; *) return 2 ;; esac
}

recover() {
  local id image ref service revision split identity running actual_image actual_ref actual_project actual_service all_split=1 ids network_snapshot
  local -a captured=()
  load_snapshot || return 1
  # Validate every captured identity before starting any writer; a tag alone is insufficient.
  while IFS='|' read -r id image ref service revision split; do
    [ "$id" != captured ] || break
    [[ "$id" =~ ^[0-9a-f]{64}$ ]] || return 1
    identity="$(docker inspect --format '{{.State.Running}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}' "$id")" || return 1
    IFS='|' read -r running actual_image actual_ref actual_project actual_service <<< "$identity"
    [ "$image|$ref|$project|$service" = "$actual_image|$actual_ref|$actual_project|$actual_service" ] || return 1
    [ "$(image_identity "$image" "$service")" = "$image|$revision|$split" ] || return 1
    [ "$split" = 1 ] || all_split=0
    captured+=("$id")
  done < <(tail -n +2 "$snapshot")
  [ "${#captured[@]}" -gt 0 ] || return 1
  # An old activation may have introduced unsafe writers. Stop them before recovery.
  ids="$(writers)" || return 1
  if [ -n "$ids" ]; then
    mapfile -t active <<< "$ids"
    # Include any newly activated old/current/duplicate writers, not only snapshot IDs.
    network_snapshot="$(mktemp "${snapshot}.recovery-network.XXXXXX")" || return 1
    capture_network "${active[@]}" > "$network_snapshot" || return 1
    docker stop "${active[@]}" >/dev/null || return 1
  fi
  quiescent || return 1
  # Failed attempts can leave stopped additional writers with live backends.
  # Preserve and validate EVERY ownership snapshot across retries, never overwrite.
  for network_snapshot in "${snapshot}.recovery-network" "${snapshot}".recovery-network.*; do
    [ ! -e "$network_snapshot" ] || drained "$network_snapshot" || return 1
  done
  drained "${snapshot}.network" || return 1
  if [ "$all_split" != 1 ]; then data_safe || return 1; fi
  quiescent || return 1
  drained "${snapshot}.network" || return 1
  docker start "${captured[@]}" >/dev/null || return 1
  echo "split rollback: recovered captured current container IDs and immutable images"
}

if [ "$mode" = recheck ]; then
  load_snapshot || fail "captured runtime is invalid"
  quiescent || fail "writers are running before switch"
  drained "${snapshot}.network" || fail "writer PostgreSQL sessions are not drained before switch"
  exit 0
fi
if [ "$mode" = recover ]; then
  recover || fail "safe captured current recovery cannot be confirmed"
  exit 0
fi

# Read-only image/data preflight cannot authorize a fixed-only downgrade.
target_web="$(image_identity "$web" web)" || fail "web image revision/identity preflight failed"
target_bot="$(image_identity "$bot" bot)" || fail "bot image revision/identity preflight failed"
data_safe || { result=$?; [ "$result" != 2 ] || fail "preflight query failed"; }
project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' vt_web)" || fail "project identity unavailable"
[[ "$project" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || fail "invalid project identity"
[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' vt_bot)" = "$project" ] || fail "web/bot project identity mismatch"
[ ! -e "$snapshot" ] || fail "captured runtime already exists; inspect prior attempt"
ids="$(writers -a)" || fail "writer enumeration failed"
[ -n "$ids" ] || fail "current writer identity unavailable"
temp="$(mktemp "${snapshot}.XXXXXX")"
trap 'rm -f -- "$temp"' EXIT
printf '%s\n' "$project" > "$temp"
captured=()
web_count=0; bot_count=0
while read -r id; do
  [[ "$id" =~ ^[0-9a-f]{64}$ ]] || fail "invalid writer container ID"
  identity="$(docker inspect --format '{{.State.Running}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}' "$id")" || fail "writer capture failed"
  IFS='|' read -r running image ref actual_project service <<< "$identity"
  [ "$actual_project" = "$project" ] && [[ "$service" = web || "$service" = bot ]] || fail "writer project/service mismatch"
  [ "$running" = true ] || continue
  immutable="$(image_identity "$image" "$service")" || fail "captured current image identity is unproven"
  referenced="$(image_identity "$ref" "$service")" || fail "captured current reference is unproven"
  [ "$immutable" = "$referenced" ] || fail "captured image reference changed"
  IFS='|' read -r actual_image revision split <<< "$immutable"
  [ "$actual_image" = "$image" ] || fail "captured immutable image mismatch"
  printf '%s|%s|%s|%s|%s|%s\n' "$id" "$image" "$ref" "$service" "$revision" "$split" >> "$temp"
  captured+=("$id")
  if [ "$service" = web ]; then web_count=$((web_count + 1)); else bot_count=$((bot_count + 1)); fi
done <<< "$ids"
[ "$web_count" -gt 0 ] && [ "$bot_count" -gt 0 ] || fail "active web/bot capture incomplete"
capture_network "${captured[@]}" > "${snapshot}.network" || fail "writer network ownership capture failed before stop"
printf 'captured\n' >> "$temp"
chmod 600 "$temp"
mv "$temp" "$snapshot"
trap - EXIT

deny() {
  echo "split rollback: $*" >&2
  recover || echo "split rollback: safe recovery unconfirmed; writers remain stopped where possible" >&2
  fail "downgrade denied; current state retained in $snapshot"
}
docker stop "${captured[@]}" >/dev/null || deny "writer stop failed"
quiescent || deny "writers are running after stop"
drained "${snapshot}.network" || deny "writer PostgreSQL sessions are not drained after stop"
if data_safe; then :; else
  result=$?
  [ "$result" != 2 ] || deny "authoritative query failed"
  [[ "$target_web" = *'|1' && "$target_bot" = *'|1' ]] || deny "split rows require compatible web and bot images"
fi
quiescent || deny "writers are running before switch"
drained "${snapshot}.network" || deny "writer PostgreSQL sessions are not drained before switch"
echo "split rollback: authoritative guard passed; keep writers stopped through activation"
