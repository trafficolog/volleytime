#!/usr/bin/env bash
# Первичная настройка dev-окружения с нуля (Task 3.9.11).
set -euo pipefail
cd "$(dirname "$0")/.."

need() { command -v "$1" >/dev/null 2>&1 || { echo "✗ требуется $1" >&2; exit 1; }; }
need node
need docker
node -e 'const [maj]=process.versions.node.split(".").map(Number); if (maj < 22) { console.error("✗ нужен Node >= 22"); process.exit(1) }'
command -v pnpm >/dev/null 2>&1 || corepack enable

echo "→ pnpm install"
pnpm install --frozen-lockfile

if [ ! -f .env ]; then
  cp .env.example .env
  echo "→ создан .env из .env.example — заполните TELEGRAM_BOT_TOKEN и BETTER_AUTH_SECRET"
fi

echo "→ postgres (docker compose)"
docker compose up -d
./scripts/wait-for-db.sh localhost 5432 60

set -a; . ./.env; set +a
echo "→ миграции dev"
pnpm db:migrate
echo "→ миграции test"
DATABASE_URL="$DATABASE_URL_TEST" pnpm db:migrate

echo "✓ готово: pnpm dev"
