---
id: '3.2.1'
phase: '3'
epic: '3.2'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - BACK
  - DB
depends_on:
  - '3.1.3'
estimated_hours: '2'
tags:
  - drizzle
  - postgres
  - orm
---

# Task 3.2.1: Drizzle setup + connection + client

## Цель

Установить Drizzle ORM в `packages/db`, настроить подключение к PostgreSQL, создать экспортируемый client (`db`), который используется во всех модулях.

## Контекст

Drizzle — type-safe ORM. После этой задачи в `packages/db` есть готовый client, который мы импортируем везде: `import { db } from '@volley-time/db'`.

Connection через `postgres-js` (предпочтительнее `pg`, лучше производительность).

## Что должно быть сделано

1. **Установить зависимости в `packages/db`:**

   ```bash
   pnpm -F @volley-time/db add drizzle-orm postgres
   pnpm -F @volley-time/db add -D drizzle-kit @types/pg
   ```

2. **Создать структуру:**

   ```
   packages/db/
   ├── src/
   │   ├── schema/
   │   │   └── index.ts        # пока пустой
   │   ├── client.ts           # Drizzle client
   │   ├── index.ts            # экспорт всего публичного API
   │   └── env.ts              # валидация ENV variables
   ├── migrations/             # сюда будут писаться SQL миграции
   ├── drizzle.config.ts
   ├── package.json
   └── tsconfig.json
   ```

3. **`src/env.ts`** — валидация DATABASE_URL:

   ```ts
   const databaseUrl = process.env.DATABASE_URL
   if (!databaseUrl) {
     throw new Error('DATABASE_URL is not set')
   }
   export const env = {
     DATABASE_URL: databaseUrl,
     DATABASE_URL_TEST: process.env.DATABASE_URL_TEST,
   } as const
   ```

4. **`src/client.ts`** — создание Drizzle client:

   ```ts
   import { drizzle } from 'drizzle-orm/postgres-js'
   import postgres from 'postgres'
   import { env } from './env'
   import * as schema from './schema'

   const queryClient = postgres(env.DATABASE_URL, {
     max: 10,
     idle_timeout: 20,
     connect_timeout: 10,
   })

   export const db = drizzle(queryClient, {
     schema,
     logger: process.env.NODE_ENV === 'development',
   })

   export type DB = typeof db
   ```

5. **`drizzle.config.ts`:**

   ```ts
   import { defineConfig } from 'drizzle-kit'

   export default defineConfig({
     schema: './src/schema/index.ts',
     out: './migrations',
     dialect: 'postgresql',
     dbCredentials: {
       url: process.env.DATABASE_URL!,
     },
     verbose: true,
     strict: true,
   })
   ```

6. **`src/index.ts`** — публичный API:

   ```ts
   export { db, type DB } from './client'
   export * from './schema'
   ```

7. **package.json scripts:**
   ```json
   "scripts": {
     "db:generate": "drizzle-kit generate",
     "db:migrate": "drizzle-kit migrate",
     "db:studio": "drizzle-kit studio",
     "db:drop": "drizzle-kit drop",
     "typecheck": "tsc --noEmit",
     "test": "vitest run",
     "lint": "eslint ."
   }
   ```

## Критерии приёмки

- ✅ `pnpm -F @volley-time/db typecheck` проходит
- ✅ Импорт `import { db } from '@volley-time/db'` работает в других пакетах после `pnpm install`
- ✅ С запущенным PostgreSQL (Epic 3.6) — `pnpm -F @volley-time/db db:studio` открывает Drizzle Studio
- ✅ Если `DATABASE_URL` не задан — модуль бросает понятную ошибку при импорте
- ✅ Connection pooling работает (max 10 connections)

## Подсказки

- **`postgres-js` vs `pg`:** postgres-js существенно быстрее и имеет лучший TypeScript support. Drizzle их обоих поддерживает.
- **`logger: true`** в Drizzle — печатает все SQL запросы в console. Полезно в dev, выключаем в prod через env-проверку.
- **`schema: schema`** — передаём весь schema namespace в drizzle, что позволяет потом писать `db.query.users.findFirst(...)` — relational queries.
- Если import постоянно ломается в IDE — проверь, что в `packages/db/package.json` есть:
  ```json
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  }
  ```

## Не делать

- ❌ Не создавать сам schema (User, Account и т.д.) — это 3.2.2
- ❌ Не настраивать миграции автоматически — это 3.2.3
- ❌ Не подключать другую БД (MySQL, SQLite) — только PostgreSQL
- ❌ Не использовать `node-postgres` (pg) — мы выбрали `postgres-js`
- ❌ Не настраивать read-replicas — Phase 14+
