#!/usr/bin/env bash
set -euo pipefail

umask 077

ROOT="${VOLLEYTIME_ROOT:-/opt/volleytime}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT}/docker-compose.prod.yml}"
BACKUP_DIR="${LOCAL_BACKUP_DIR:-/opt/volleytime/backups}"
KEEP="${LOCAL_BACKUP_KEEP:-10}"
MIN_SIZE_BYTES="${LOCAL_BACKUP_MIN_SIZE_BYTES:-1024}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
FINAL="${BACKUP_DIR}/volleytime_${TIMESTAMP}.sql.gz"
TMP="${FINAL}.partial"

case "$KEEP" in
  '' | *[!0-9]*) echo "LOCAL_BACKUP_KEEP must be a positive integer" >&2; exit 2 ;;
esac
[ "$KEEP" -gt 0 ] || { echo "LOCAL_BACKUP_KEEP must be greater than zero" >&2; exit 2; }

cleanup() {
  rm -f -- "$TMP"
}
trap cleanup EXIT HUP INT TERM

cd "$ROOT"
install -d -m 700 "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "[backup-local] creating ${FINAL##*/}"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U volley volleytime | gzip -c > "$TMP"

SIZE_BYTES="$(stat -c%s "$TMP")"
[ "$SIZE_BYTES" -ge "$MIN_SIZE_BYTES" ] || {
  echo "[backup-local] dump is too small: ${SIZE_BYTES} bytes" >&2
  exit 1
}
gzip -t "$TMP"
chmod 600 "$TMP"
mv -- "$TMP" "$FINAL"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'volleytime_*.sql.gz' -printf '%f\n' |
  sort -r |
  tail -n "+$((KEEP + 1))" |
  while IFS= read -r old; do
    [ -n "$old" ] && rm -f -- "$BACKUP_DIR/$old"
  done

trap - EXIT HUP INT TERM
echo "[backup-local] ready: ${FINAL} (${SIZE_BYTES} bytes)"
