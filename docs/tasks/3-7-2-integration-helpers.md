---
id: '3.7.2'
phase: '3'
epic: '3.7'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - QA
  - BACK
depends_on:
  - '3.7.1'
  - '3.2.3'
estimated_hours: '1-2'
tags:
  - vitest
  - integration
  - test-helpers
---

# Task 3.7.2: Helpers для integration-тестов (test DB, migrations, fixtures)

## Цель

Создать набор тестовых хелперов: подключение к тестовой БД, применение миграций перед запуском, cleanup между тестами, фабрики данных (createTestUser).

## Контекст

Интеграционные тесты идут против реальной PG (`volleytime_test` БД). Чтобы тесты были изолированы, перед каждым `describe` (или test) — БД должна быть в чистом состоянии.

Подход:

1. Перед всеми тестами — применить миграции на test-БД (один раз)
2. Перед каждым `describe` — truncate всех таблиц (быстрее чем drop+migrate)
3. Опционально — каждый тест в transaction с rollback (для максимальной изоляции, но сложнее)

В Phase 3 используем truncate-подход (проще). Если станет проблемой — переходим на transaction-rollback в Phase 5+.

## Что должно быть сделано

1. **`packages/db/src/test-utils.ts`:**

   ```ts
   import { drizzle } from 'drizzle-orm/postgres-js'
   import postgres from 'postgres'
   import { sql } from 'drizzle-orm'
   import { migrate } from 'drizzle-orm/postgres-js/migrator'
   import * as schema from './schema'
   import path from 'node:path'
   import { fileURLToPath } from 'node:url'

   const __dirname = path.dirname(fileURLToPath(import.meta.url))

   export interface TestDb {
     db: ReturnType<typeof drizzle<typeof schema>>
     truncate: () => Promise<void>
     close: () => Promise<void>
   }

   /**
    * Creates a test DB connection.
    * Migrations applied once globally (via globalSetup).
    */
   export async function createTestDb(): Promise<TestDb> {
     const url = process.env.DATABASE_URL_TEST
     if (!url) throw new Error('DATABASE_URL_TEST is not set')

     const client = postgres(url, { max: 5, idle_timeout: 5 })
     const db = drizzle(client, { schema })

     return {
       db,
       async truncate() {
         // Truncate all user tables (skip drizzle migrations table)
         await db.execute(sql`
           DO $$
           DECLARE
             r RECORD;
           BEGIN
             FOR r IN (
               SELECT tablename FROM pg_tables
               WHERE schemaname = 'public'
                 AND tablename NOT LIKE '__drizzle%'
             ) LOOP
               EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
             END LOOP;
           END $$;
         `)
       },
       async close() {
         await client.end()
       },
     }
   }

   /** Apply migrations to test DB. Run once globally. */
   export async function applyTestMigrations() {
     const url = process.env.DATABASE_URL_TEST
     if (!url) throw new Error('DATABASE_URL_TEST is not set')
     const client = postgres(url, { max: 1 })
     const db = drizzle(client)
     const migrationsFolder = path.join(__dirname, '../migrations')
     await migrate(db, { migrationsFolder })
     await client.end()
   }
   ```

2. **`packages/db/test-setup.ts`** — globalSetup:

   ```ts
   import { applyTestMigrations } from './src/test-utils'

   export async function setup() {
     console.log('Applying migrations to test DB...')
     await applyTestMigrations()
     console.log('Test DB ready')
   }
   ```

3. **Обновить `vitest.integration.config.ts`:**

   ```ts
   import { defineConfig } from 'vitest/config'

   export default defineConfig({
     test: {
       name: '@volley-time/db (integration)',
       environment: 'node',
       include: ['src/**/*.integration.test.ts'],
       globalSetup: ['./test-setup.ts'],
       pool: 'forks',
       poolOptions: { forks: { singleFork: true } },
       testTimeout: 10000,
       hookTimeout: 30000,
     },
   })
   ```

4. **`packages/db/src/__tests__/fixtures.ts`** — фабрики данных:

   ```ts
   import type { DB } from '../client'
   import { users, type NewUser } from '../schema'

   let userCounter = 0

   export async function createTestUser(db: DB, overrides: Partial<NewUser> = {}) {
     userCounter++
     const [user] = await db
       .insert(users)
       .values({
         email: overrides.email ?? `test-${userCounter}-${Date.now()}@example.com`,
         name: overrides.name ?? `Test User ${userCounter}`,
         ...overrides,
       })
       .returning()
     if (!user) throw new Error('Failed to create test user')
     return user
   }

   export async function createTelegramUser(db: DB, overrides: Partial<NewUser> = {}) {
     userCounter++
     const [user] = await db
       .insert(users)
       .values({
         telegramUserId: BigInt(1000000 + userCounter),
         telegramUsername: `tguser${userCounter}`,
         name: overrides.name ?? `Telegram User ${userCounter}`,
         ...overrides,
       })
       .returning()
     if (!user) throw new Error('Failed to create telegram user')
     return user
   }
   ```

5. **Экспорт из `packages/db/src/index.ts`:**

   ```ts
   export { createTestDb, applyTestMigrations } from './test-utils'
   export { createTestUser, createTelegramUser } from './__tests__/fixtures'
   ```

   Или лучше — отдельный entrypoint для test-utils, чтобы они не попадали в production bundle:

   ```json
   // packages/db/package.json
   "exports": {
     ".": "./src/index.ts",
     "./test-utils": "./src/test-utils.ts"
   }
   ```

## Критерии приёмки

- ✅ `globalSetup` применяет миграции к `volleytime_test` БД (один раз)
- ✅ `createTestDb()` возвращает рабочий db client
- ✅ `truncate()` очищает все user-таблицы, не трогает `__drizzle_migrations`
- ✅ Counter ID сбрасывается после truncate (`RESTART IDENTITY`)
- ✅ `createTestUser(db)` создаёт user с unique email
- ✅ `createTelegramUser(db)` создаёт user с unique telegram_user_id
- ✅ test-utils экспортируется через отдельный entrypoint `@volley-time/db/test-utils`

## Подсказки

- **TRUNCATE ... RESTART IDENTITY CASCADE** — сбрасывает serial счётчики и каскадно удаляет связанные записи. Безопасно после миграций.
- **PostgreSQL DO ... pg_tables** — динамически получает список таблиц. Альтернатива — захардкодить список (быстрее, но требует поддержки при добавлении новых таблиц).
- **Тестовая БД должна существовать ДО запуска тестов** — это делается init-скриптом в Docker compose (3.6.1).
- **Если migrations занимают > 30 секунд** — что-то не так со схемой. На MVP объёме (5 таблиц) — < 1 сек.

## Не делать

- ❌ Не использовать testcontainers — мы выбрали shared PG approach
- ❌ Не делать «каждый тест в transaction с rollback» — пока не нужно
- ❌ Не делать seeders для production — это для test only
- ❌ Не экспортировать test-utils из main entrypoint — отдельный путь
