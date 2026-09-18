---
id: '3.6.2'
phase: '3'
epic: '3.6'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - DEVOPS
depends_on:
  - '3.6.1'
  - '3.1.2'
estimated_hours: '1'
tags:
  - dev-tools
  - scripts
---

# Task 3.6.2: pnpm-scripts для управления dev environment

## Цель

Добавить корневые pnpm-скрипты для удобной работы с dev-окружением: `dev:db`, `dev:db:down`, `dev:db:reset`, `dev:db:logs`, `dev` (всё вместе).

## Контекст

Чтобы разработчик не запоминал `docker compose ...` команды и порядок запуска — обернём всё в pnpm scripts.

## Что должно быть сделано

1. **Обновить корневой `package.json`:**

   ```json
   {
     "scripts": {
       "dev": "pnpm dev:db && turbo run dev",
       "dev:db": "docker compose up -d",
       "dev:db:down": "docker compose down",
       "dev:db:reset": "docker compose down -v && docker compose up -d",
       "dev:db:logs": "docker compose logs -f postgres redis",
       "dev:web": "pnpm -F @volley-time/web dev",
       "dev:bot": "pnpm -F @volley-time/bot dev",
       "build": "turbo run build",
       "test": "turbo run test",
       "test:integration": "pnpm db:migrate:test && turbo run test:integration",
       "lint": "eslint .",
       "lint:fix": "eslint . --fix",
       "format": "prettier --write .",
       "format:check": "prettier --check .",
       "typecheck": "turbo run typecheck",
       "db:generate": "pnpm -F @volley-time/db db:generate",
       "db:migrate": "pnpm -F @volley-time/db db:migrate",
       "db:migrate:test": "DATABASE_URL=$DATABASE_URL_TEST pnpm -F @volley-time/db db:migrate",
       "db:studio": "pnpm -F @volley-time/db db:studio",
       "clean": "turbo run clean && rm -rf node_modules .turbo"
     }
   }
   ```

2. **Создать `scripts/wait-for-db.sh`** — bash утилита для ожидания PG:

   ```bash
   #!/usr/bin/env bash
   set -e

   echo "Waiting for PostgreSQL..."
   max_attempts=30
   attempt=0
   until pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; do
     attempt=$((attempt + 1))
     if [ $attempt -ge $max_attempts ]; then
       echo "❌ PostgreSQL did not start in time"
       exit 1
     fi
     sleep 1
   done
   echo "✅ PostgreSQL is ready"
   ```

   Сделать executable: `chmod +x scripts/wait-for-db.sh`

3. **Опционально: обновить `dev` script:**

   ```json
   "dev": "pnpm dev:db && ./scripts/wait-for-db.sh && pnpm db:migrate && turbo run dev"
   ```

   Это: запустить БД → дождаться → применить миграции → запустить apps.

4. **Создать `scripts/setup.sh`** — onboarding для нового разработчика:

   ```bash
   #!/usr/bin/env bash
   set -e

   echo "🏐 Volley Time setup"
   echo ""

   # Проверки
   command -v pnpm >/dev/null || { echo "❌ pnpm не установлен"; exit 1; }
   command -v docker >/dev/null || { echo "❌ docker не установлен"; exit 1; }

   # Установка зависимостей
   echo "📦 Установка зависимостей..."
   pnpm install

   # Создание .env
   if [ ! -f .env ]; then
     echo "🔧 Создание .env из .env.example..."
     cp .env.example .env
     echo "⚠️  Отредактируй .env (TELEGRAM_BOT_TOKEN, BETTER_AUTH_SECRET)"
   fi

   # Старт БД
   echo "🐘 Старт PostgreSQL и Redis..."
   pnpm dev:db
   ./scripts/wait-for-db.sh

   # Миграции
   echo "📜 Применение миграций..."
   pnpm db:migrate

   echo ""
   echo "✅ Готово! Запусти:"
   echo "   pnpm dev      — старт всего проекта"
   echo "   pnpm db:studio — открыть Drizzle Studio"
   ```

   Сделать executable.

5. **Обновить корневой `README.md`** — quickstart:

   ````markdown
   ## Локальный запуск

   ```bash
   # Первый раз
   ./scripts/setup.sh

   # Каждый день
   pnpm dev
   ```
   ````

   Откроется:
   - Web: http://localhost:3000
   - Drizzle Studio: `pnpm db:studio`
   - Bot: запущен в long-polling режиме

   ```

   ```

## Критерии приёмки

- ✅ `./scripts/setup.sh` работает с нуля на чистой машине (после `git clone`)
- ✅ `pnpm dev:db` запускает контейнеры
- ✅ `pnpm dev:db:reset` стирает данные и пересоздаёт
- ✅ `pnpm dev` запускает: контейнеры → миграции → apps (web + bot)
- ✅ `pnpm dev:web` и `pnpm dev:bot` запускают по отдельности
- ✅ `pnpm db:migrate:test` применяет миграции к тестовой БД (для CI)
- ✅ Все скрипты исполняемые (`chmod +x`)
- ✅ В README обновлена секция quickstart

## Подсказки

- **На Windows:** bash-скрипты не работают нативно. Альтернативы:
  - WSL2 (рекомендуется)
  - Git Bash (для простых случаев)
  - Cross-platform Node-script вместо bash (если нужно поддерживать Windows напрямую)
- **`pg_isready`** нужен в PATH. На macOS — `brew install libpq && brew link --force libpq`. Или используй `docker compose exec postgres pg_isready` (медленнее, но не требует client tools на хосте).
- **Можно сделать setup.sh idempotent** — повторный запуск не должен ломать ничего.

## Не делать

- ❌ Не делать make/Makefile — pnpm scripts достаточно
- ❌ Не делать PowerShell-версии скриптов — на Windows рекомендуем WSL
- ❌ Не настраивать VSCode devcontainer — Phase 9
- ❌ Не пытаться запускать всё через единый `pnpm dev` без Docker — Docker обязателен
