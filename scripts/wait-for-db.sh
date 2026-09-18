#!/usr/bin/env bash
# Ждёт готовности Postgres (для CI/локального старта).
set -euo pipefail

HOST="${1:-localhost}"
PORT="${2:-5432}"
RETRIES="${3:-30}"

echo "Waiting for Postgres at ${HOST}:${PORT}..."
for i in $(seq 1 "${RETRIES}"); do
  if pg_isready -h "${HOST}" -p "${PORT}" >/dev/null 2>&1; then
    echo "Postgres is ready."
    exit 0
  fi
  sleep 1
done
echo "Postgres not ready after ${RETRIES}s" >&2
exit 1
