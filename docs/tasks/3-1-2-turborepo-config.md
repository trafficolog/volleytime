---
id: '3.1.2'
phase: '3'
epic: '3.1'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - DEVOPS
depends_on:
  - '3.1.1'
estimated_hours: '1-2'
tags:
  - turborepo
  - monorepo
  - build
---

# Task 3.1.2: Turborepo с базовыми pipelines

## Цель

Добавить Turborepo для кеширования и параллельного выполнения задач (`dev`, `build`, `test`, `lint`, `typecheck`).

## Контекст

Без Turborepo на каждый `pnpm test` мы запускаем тесты во всех пакетах последовательно. С Turborepo они выполняются параллельно + кешируются (если код не менялся, тест skip'ается).

В нашем размере (5 пакетов) уже даёт выгоду 2-5x. После роста до 10+ пакетов — критично.

## Что должно быть сделано

1. **Установить turbo в корень (dev dependency):**

   ```bash
   pnpm add -Dw turbo
   ```

   (`-w` = workspace root)

2. **Создать `turbo.json`:**

   ```json
   {
     "$schema": "https://turbo.build/schema.json",
     "globalEnv": [
       "NODE_ENV",
       "DATABASE_URL",
       "DATABASE_URL_TEST",
       "REDIS_URL",
       "TELEGRAM_BOT_TOKEN",
       "TELEGRAM_BOT_USERNAME",
       "BETTER_AUTH_SECRET",
       "BETTER_AUTH_URL",
       "EMAIL_DRIVER"
     ],
     "tasks": {
       "build": {
         "dependsOn": ["^build"],
         "outputs": ["dist/**", ".output/**", ".nuxt/**"],
         "cache": true
       },
       "dev": {
         "cache": false,
         "persistent": true
       },
       "lint": {
         "dependsOn": ["^lint"],
         "cache": true
       },
       "typecheck": {
         "dependsOn": ["^typecheck"],
         "cache": true
       },
       "test": {
         "dependsOn": ["^build"],
         "outputs": ["coverage/**"],
         "cache": true
       },
       "test:integration": {
         "dependsOn": ["^build"],
         "cache": false
       },
       "clean": {
         "cache": false
       }
     }
   }
   ```

3. **Обновить корневой `package.json` scripts:**

   ```json
   "scripts": {
     "dev": "turbo run dev",
     "build": "turbo run build",
     "test": "turbo run test",
     "test:integration": "turbo run test:integration",
     "lint": "turbo run lint",
     "typecheck": "turbo run typecheck",
     "clean": "turbo run clean && rm -rf node_modules .turbo"
   }
   ```

4. **Каждый пакет получает базовые scripts (заглушки на этом этапе):**
   ```json
   "scripts": {
     "dev": "echo 'todo'",
     "build": "echo 'todo'",
     "test": "echo 'no tests yet' && exit 0",
     "lint": "echo 'todo'",
     "typecheck": "echo 'todo'"
   }
   ```

## Критерии приёмки

- ✅ `pnpm dev` показывает что Turborepo запускает `dev` во всех пакетах параллельно (даже если они заглушки)
- ✅ `pnpm build` работает и кеширует результат (второй запуск — `FULL TURBO`)
- ✅ `pnpm test` запускает тесты во всех пакетах
- ✅ `pnpm clean` стирает кеш и все артефакты
- ✅ `.turbo/` папка добавлена в `.gitignore` (из 3.1.1)
- ✅ После `pnpm clean && pnpm install` запуски работают как с нуля

## Подсказки

- **`dependsOn: ["^build"]`** означает, что задача требует, чтобы `build` сначала отработал во **всех зависимостях этого пакета**. Это критично для пакетов, которые импортируют друг друга.
- **`persistent: true`** для `dev` — указывает что задача не завершается (длительный watch-mode), Turbo не ждёт её окончания.
- **`globalEnv`** — список переменных окружения, изменения которых инвалидируют cache.
- Если хочется визуализировать граф зависимостей — `turbo run build --graph` рисует SVG.

## Не делать

- ❌ Не настраивать `outputs` для Vue/Nuxt build — Nuxt уже это делает через `.nuxt/`, `.output/`
- ❌ Не настраивать remote caching (Turbo Cloud) — Phase 14+
- ❌ Не делать кастомные tasks типа `db:migrate` через Turbo — оставляем `pnpm -F @volley-time/db <script>`
