---
id: '3.2.3'
phase: '3'
epic: '3.2'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - DEVOPS
  - DB
depends_on:
  - '3.2.2'
estimated_hours: '1-2'
tags:
  - drizzle
  - migrations
  - devops
---

# Task 3.2.3: Миграционный workflow (generate, migrate)

## Цель

Создать первую миграцию через `drizzle-kit generate`, написать миграционный runner для applying в runtime (для CI и dev), задокументировать workflow.

## Контекст

`drizzle-kit generate` создаёт SQL-файл миграции на основе диффа между текущей схемой и состоянием БД. `drizzle-kit migrate` применяет миграции к БД.

В отличие от `push`, generate даёт версионированные SQL-файлы — это правильный prod workflow.

## Что должно быть сделано

1. **Сгенерировать первую миграцию:**

   ```bash
   pnpm -F @volley-time/db db:generate
   ```

   Drizzle создаст `packages/db/migrations/0000_<random_name>.sql` со всеми CREATE TABLE для User, Account, Session, VerificationToken.

2. **Закоммитить миграцию.** SQL-файлы миграций — часть кодовой базы.

3. **Применить миграцию:**

   ```bash
   pnpm -F @volley-time/db db:migrate
   ```

   Drizzle создаст таблицу `__drizzle_migrations` (для отслеживания) и применит все pending миграции.

4. **`packages/db/src/migrate.ts`** — программный runner (нужен для CI и programmatic use):

   ```ts
   import { drizzle } from 'drizzle-orm/postgres-js'
   import { migrate } from 'drizzle-orm/postgres-js/migrator'
   import postgres from 'postgres'
   import path from 'node:path'
   import { fileURLToPath } from 'node:url'

   const __dirname = path.dirname(fileURLToPath(import.meta.url))
   const migrationsFolder = path.join(__dirname, '../migrations')

   export async function runMigrations(databaseUrl: string) {
     const migrationClient = postgres(databaseUrl, { max: 1 })
     const migrationDb = drizzle(migrationClient)
     console.log(`Applying migrations from ${migrationsFolder}...`)
     await migrate(migrationDb, { migrationsFolder })
     await migrationClient.end()
     console.log('Migrations applied.')
   }

   // CLI entrypoint
   if (import.meta.url === `file://${process.argv[1]}`) {
     const url = process.env.DATABASE_URL
     if (!url) throw new Error('DATABASE_URL not set')
     await runMigrations(url)
   }
   ```

5. **Обновить scripts в `packages/db/package.json`:**

   ```json
   "scripts": {
     "db:generate": "drizzle-kit generate",
     "db:migrate": "tsx src/migrate.ts",
     "db:migrate:kit": "drizzle-kit migrate",
     "db:studio": "drizzle-kit studio",
     "db:drop": "drizzle-kit drop"
   }
   ```

   (`tsx` — для исполнения TS-файлов как скриптов)

6. **Корневые scripts в `package.json`:**

   ```json
   "db:generate": "pnpm -F @volley-time/db db:generate",
   "db:migrate": "pnpm -F @volley-time/db db:migrate",
   "db:studio": "pnpm -F @volley-time/db db:studio"
   ```

7. **Установить `tsx`:**

   ```bash
   pnpm -F @volley-time/db add -D tsx
   ```

8. **Создать README в `packages/db/`:**
   ```markdown
   # @volley-time/db

   ## Команды

   - `pnpm db:generate` — сгенерировать новую миграцию из изменений в schema
   - `pnpm db:migrate` — применить pending миграции (через tsx runner)
   - `pnpm db:studio` — открыть Drizzle Studio в браузере

   ## Workflow

   1. Изменить schema в `src/schema/*.ts`
   2. Запустить `pnpm db:generate` — создаст SQL файл в `migrations/`
   3. Проверить SQL вручную (Drizzle иногда генерирует subtle ошибки)
   4. Закоммитить файл
   5. Запустить `pnpm db:migrate` — применить
   ```

## Критерии приёмки

- ✅ После `pnpm db:generate` создан файл в `migrations/`
- ✅ После `pnpm db:migrate` в БД есть таблицы: `users`, `accounts`, `sessions`, `verification_tokens`, `__drizzle_migrations`
- ✅ Повторный `pnpm db:migrate` — no-op (видно "no migrations to run")
- ✅ `pnpm db:studio` открывает Drizzle Studio, видны все таблицы
- ✅ В CI можно запустить `pnpm db:migrate` против чистой БД (Epic 3.8)
- ✅ README в packages/db есть и содержит инструкции

## Подсказки

- **Если изменил schema и `pnpm db:generate` не видит изменений** — проверь, что schema-файл экспортирован из `schema/index.ts`.
- **Drizzle Studio** работает на `https://local.drizzle.studio` — это нормально, она клиент-side, но соединяется с БД через локальный сервер.
- **Откат миграции** — Drizzle не делает down-миграций автоматически. Если нужно — ручной SQL. Для dev — `pnpm db:drop` обнуляет всё (опасно).
- **Имена файлов миграций** — `0000_silly_name.sql`. Drizzle добавляет случайное прилагательное и существительное (как Docker контейнеры). Это норма.

## Не делать

- ❌ Не редактировать сгенерированные миграции вручную после применения — создавай новую
- ❌ Не коммитить локальный `.env` (только `.env.example`)
- ❌ Не использовать `drizzle-kit push` — только `generate + migrate`
- ❌ Не настраивать миграции на startup приложения автоматически — это сделается в CI (Phase 3.8) и явно через `pnpm db:migrate` в production deploy (Phase 9)
