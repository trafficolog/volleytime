---
id: '3.7.1'
phase: '3'
epic: '3.7'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - QA
  - DEVOPS
depends_on:
  - '3.1.3'
estimated_hours: '1'
tags:
  - vitest
  - tests
---

# Task 3.7.1: Vitest setup + workspaces config

## Цель

Настроить Vitest в каждом пакете, добавить workspaces config для запуска всех тестов одной командой, разделить unit-тесты (быстрые, mocked) и integration-тесты (с реальной PG).

## Контекст

Vitest — современная замена Jest, в 2-5 раз быстрее и TypeScript-native. Поддерживает workspaces.

В Phase 3 закладываем минимум: каждый пакет имеет Vitest, root `pnpm test` запускает всё через Turborepo.

## Что должно быть сделано

1. **Установить Vitest в корне (для shared dev-зависимости):**

   ```bash
   pnpm add -Dw vitest @vitest/ui
   ```

2. **В каждом пакете добавить Vitest:**

   ```bash
   # для packages/db, packages/auth, packages/shared, apps/web, apps/bot
   pnpm -F @volley-time/db add -D vitest
   # ...повторить для остальных пакетов
   ```

3. **Создать `vitest.workspace.ts` в корне:**

   ```ts
   import { defineWorkspace } from 'vitest/config'

   export default defineWorkspace(['apps/*', 'packages/*'])
   ```

4. **В каждом пакете создать `vitest.config.ts`:**

   Пример для `packages/db/vitest.config.ts`:

   ```ts
   import { defineConfig } from 'vitest/config'

   export default defineConfig({
     test: {
       name: '@volley-time/db',
       environment: 'node',
       include: ['src/**/*.test.ts'],
       exclude: ['src/**/*.integration.test.ts'],
     },
   })
   ```

   Для интеграционных создаём отдельный `vitest.integration.config.ts`:

   ```ts
   import { defineConfig } from 'vitest/config'

   export default defineConfig({
     test: {
       name: '@volley-time/db (integration)',
       environment: 'node',
       include: ['src/**/*.integration.test.ts'],
       // Sequence через single fork для безопасности
       pool: 'forks',
       poolOptions: {
         forks: { singleFork: true },
       },
       testTimeout: 10000,
       hookTimeout: 30000, // для migrations
     },
   })
   ```

5. **Скрипты в каждом package.json:**

   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:integration": "vitest run --config vitest.integration.config.ts"
   }
   ```

6. **Корневые скрипты (обновить из 3.6.2):**

   ```json
   "test": "turbo run test",
   "test:integration": "turbo run test:integration",
   "test:ui": "vitest --ui"
   ```

7. **`turbo.json` — добавить test:integration:**

   ```json
   "tasks": {
     "test:integration": {
       "dependsOn": ["^build"],
       "cache": false,
       "env": ["DATABASE_URL_TEST"]
     }
   }
   ```

8. **Smoke-test в `packages/shared`:**
   ```ts
   // packages/shared/src/__tests__/sanity.test.ts
   import { describe, test, expect } from 'vitest'

   describe('shared package', () => {
     test('vitest works', () => {
       expect(1 + 1).toBe(2)
     })
   })
   ```

## Критерии приёмки

- ✅ `pnpm test` запускает unit-тесты во всех пакетах через Turbo
- ✅ Хотя бы один smoke-тест проходит (в packages/shared)
- ✅ `pnpm test:integration` запускает интеграционные (пока пустые, но команда работает)
- ✅ `pnpm test:ui` открывает Vitest UI на browser
- ✅ Watch mode работает (`pnpm -F @volley-time/db test:watch`)
- ✅ Каждый пакет имеет свой vitest.config.ts
- ✅ Naming convention: `*.test.ts` — unit, `*.integration.test.ts` — integration

## Подсказки

- **`@vitest/ui`** запускается через `vitest --ui` — открывает локальный сайт с интерактивным runner'ом. Полезно при дебаге.
- **`testTimeout: 10000`** для integration — нужно потому что миграции и БД-операции дольше.
- **`pool: 'forks', singleFork: true`** — все integration-тесты выполняются последовательно в одном forked процессе. Это безопасно для общей тестовой БД.
- **Глобальные `describe`/`test`/`expect`:** Vitest по умолчанию требует import. Если хочется глобальных — добавь `globals: true` в config + `@types/vitest/globals` в tsconfig. Лучше явный import — typesafe.

## Не делать

- ❌ Не делать coverage report — Phase 9
- ❌ Не подключать @testing-library/vue в Phase 3 — нет UI-тестов
- ❌ Не настраивать snapshot tests — слабый ROI
- ❌ Не подключать Jest — Vitest достаточен
