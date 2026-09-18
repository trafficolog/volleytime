---
id: '3.1.1'
phase: '3'
epic: '3.1'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - DEVOPS
  - BACK
depends_on: []
estimated_hours: '1-2'
tags:
  - monorepo
  - pnpm
  - infrastructure
---

# Task 3.1.1: pnpm workspaces + структура папок

## Цель

Инициализировать корневой `package.json`, `pnpm-workspace.yaml`, создать пустые папки `apps/web`, `apps/bot`, `packages/db`, `packages/auth`, `packages/shared`. Это основа всего монорепо.

## Контекст

До этой задачи в репо только `README.md`, `docs/` и `legacy/`. После — пустые пакеты с базовыми `package.json`, готовые к наполнению.

## Что должно быть сделано

1. **Корневой `package.json`:**

   ```json
   {
     "name": "volley-time-platform",
     "version": "0.0.0",
     "private": true,
     "packageManager": "pnpm@9.x.x",
     "engines": {
       "node": ">=20.0.0"
     },
     "scripts": {
       "dev": "echo 'configured in 3.1.2 (turbo)'",
       "build": "echo 'configured in 3.1.2'",
       "test": "echo 'configured in 3.7'",
       "lint": "echo 'configured in 3.1.3'",
       "typecheck": "echo 'configured in 3.1.3'"
     }
   }
   ```

2. **`pnpm-workspace.yaml`:**

   ```yaml
   packages:
     - 'apps/*'
     - 'packages/*'
   ```

3. **Создать пустые папки и stub `package.json` в каждой:**
   - `apps/web/package.json` — `{ "name": "@volley-time/web", "version": "0.0.0", "private": true }`
   - `apps/bot/package.json` — `{ "name": "@volley-time/bot", ... }`
   - `packages/db/package.json` — `{ "name": "@volley-time/db", ... }`
   - `packages/auth/package.json` — `{ "name": "@volley-time/auth", ... }`
   - `packages/shared/package.json` — `{ "name": "@volley-time/shared", ... }`

4. **`.gitignore` корневой:**

   ```
   node_modules/
   .turbo/
   dist/
   .nuxt/
   .output/
   coverage/
   *.log
   .DS_Store
   .env
   .env.local
   .env.*.local
   !.env.example
   ```

5. **`.nvmrc`:**

   ```
   20
   ```

6. **Создать `.env.example` с placeholders:**
   ```
   # Database
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/volleytime_dev
   DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/volleytime_test

   # Redis
   REDIS_URL=redis://localhost:6379

   # Telegram
   TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
   TELEGRAM_BOT_USERNAME=volleytime_dev_bot

   # Auth
   BETTER_AUTH_SECRET=replace_with_random_32_byte_hex
   BETTER_AUTH_URL=http://localhost:3000

   # Email (dev: console, prod: Unisender Go)
   EMAIL_DRIVER=console
   # UNISENDER_GO_API_KEY=... (Phase 9)
   ```

## Критерии приёмки

- ✅ `pnpm install` работает без ошибок
- ✅ `pnpm install` создаёт `node_modules` только в корне (не в каждом пакете) — это особенность pnpm workspaces
- ✅ `pnpm -F @volley-time/db <command>` синтаксис работает (даже если команды ещё нет)
- ✅ `.env.example` существует, `.env` в `.gitignore`
- ✅ Структура папок:
  ```
  /
  ├── apps/web/package.json
  ├── apps/bot/package.json
  ├── packages/db/package.json
  ├── packages/auth/package.json
  ├── packages/shared/package.json
  ├── pnpm-workspace.yaml
  ├── package.json
  ├── .gitignore
  ├── .nvmrc
  └── .env.example
  ```

## Подсказки

- Используй `corepack enable && corepack prepare pnpm@latest --activate` для активации pnpm через Node.
- `packageManager` поле в корневом `package.json` помогает Corepack автоматически использовать правильную версию pnpm.
- Для генерации `BETTER_AUTH_SECRET` можно использовать `openssl rand -hex 32` (поместить в `.env`, не в `.env.example`).
- Названия пакетов в scoped form (`@volley-time/web`) для лучшей навигации.

## Не делать

- ❌ Не устанавливать никаких зависимостей в этой задаче (кроме `pnpm` через `corepack`)
- ❌ Не создавать содержимое пакетов (только пустые `package.json`)
- ❌ Не настраивать TypeScript / ESLint — это 3.1.3
- ❌ Не настраивать Turborepo — это 3.1.2
- ❌ Не добавлять `engines.pnpm` версию — Corepack справляется через `packageManager`
