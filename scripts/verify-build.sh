#!/usr/bin/env bash
# Проверка прод-сборки web (Task 9.9.1): собрать, поднять .output и дернуть ключевые эндпоинты.
# Использование: DATABASE_URL=... ./scripts/verify-build.sh [--skip-build]
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${VERIFY_PORT:-3123}"
: "${DATABASE_URL:?DATABASE_URL is required}"

if [ "${1:-}" != "--skip-build" ]; then
  echo "→ build web"
  pnpm -F @volley-time/web build
fi

echo "→ start .output on :$PORT"
NODE_ENV=production \
NITRO_PORT="$PORT" \
DATABASE_URL="$DATABASE_URL" \
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-verify-secret-at-least-32-characters-long}" \
BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:$PORT}" \
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-999:VERIFY}" \
TELEGRAM_BOT_USERNAME="${TELEGRAM_BOT_USERNAME:-volleytime_verify_bot}" \
BOT_INTERNAL_URL="${BOT_INTERNAL_URL:-http://localhost:3001}" \
BOT_INTERNAL_SECRET="${BOT_INTERNAL_SECRET:-verify-internal-secret}" \
WEB_URL="${WEB_URL:-http://localhost:$PORT}" \
EMAIL_DRIVER="${EMAIL_DRIVER:-console}" \
node apps/web/.output/server/index.mjs > /tmp/verify-build.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/health" || true)
  [ "$code" = "200" ] && break
  sleep 1
done

fail() { echo "✗ $1"; tail -20 /tmp/verify-build.log; exit 1; }
check() { # name expected url
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' "$3")
  [ "$got" = "$2" ] || fail "$1: ожидали $2, получили $got"
  echo "✓ $1 ($got)"
}

check "health" 200 "http://localhost:$PORT/api/health"
check "get-session" 200 "http://localhost:$PORT/api/auth/get-session"
check "главная" 200 "http://localhost:$PORT/"
check "вход" 200 "http://localhost:$PORT/auth/login"

# подделка Telegram-входа пустым токеном должна отвергаться
forged=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:$PORT/api/auth/sign-in/telegram" \
  -H 'content-type: application/json' -d '{"initData":"user=%7B%7D&hash=deadbeef"}')
[ "$forged" = "401" ] || fail "поддельный initData: ожидали 401, получили $forged"
echo "✓ поддельный initData отвергнут (401)"

# полный smoke против той же сборки (Task 9.9.2)
BASE_URL="http://localhost:$PORT" \
SMOKE_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-999:VERIFY}" \
SMOKE_TG_ID="${SMOKE_TG_ID:-900000001}" \
node scripts/smoke.mjs || fail "smoke"

echo "✓ прод-сборка работает"
