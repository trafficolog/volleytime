---
id: '3.2'
phase: '3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'packages/db с Drizzle. Базовые модели User и Account для better-auth.'
estimated_hours: '5-6'
depends_on: ['3.1']
---

# Epic 3.2: Drizzle schema + миграции

**Цель.** Создать пакет `packages/db` с Drizzle ORM, базовыми моделями (User, Account, Session — необходимый минимум для better-auth), миграционным workflow через `drizzle-kit generate`.

## Контекст

Drizzle — type-safe ORM, который мы будем использовать во всех модулях. В Phase 3 закладываем минимальную схему: только то, что нужно для **better-auth** (User, Account, Session, VerificationToken).

Бизнес-сущности (Organization, Event, Booking) — в Phase 4-5. Их добавление будет идти как Alembic-style миграции через `drizzle-kit generate`.

## Definition of Done

- Создан пакет `packages/db`
- Drizzle и `drizzle-kit` установлены
- Создан `drizzle.config.ts` с PostgreSQL connection
- Создана базовая schema: User, Account, Session, VerificationToken (для better-auth)
- Создан Drizzle client (`db` instance), экспортируется из package
- Первая миграция сгенерирована через `pnpm db:generate` и закоммичена
- Команды работают: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`
- В тестах используется отдельная БД (`volleytime_test`), drop'ается между прогонами
- TypeScript типы из Drizzle экспортируются (`User`, `Account`, etc.)

## Задачи

| ID                                             | Задача                                              | Часов |
| ---------------------------------------------- | --------------------------------------------------- | ----: |
| [3.2.1](../tasks/3-2-1-drizzle-setup.md)       | Drizzle setup + connection + client                 |     2 |
| [3.2.2](../tasks/3-2-2-user-account-schema.md) | User + Account schema (для better-auth)             |     2 |
| [3.2.3](../tasks/3-2-3-migrations-workflow.md) | Миграционный workflow (generate, migrate, rollback) |   1-2 |

## Не делать

- ❌ Не создавать Organization, Event, Booking — это Phase 4-5
- ❌ Не использовать `drizzle-kit push` (только `generate`)
- ❌ Не делать сложные индексы (только PK, FK, unique)
- ❌ Не подключать Prisma как fallback
- ❌ Не использовать JS (только TypeScript)

## Открытые вопросы

- Должна ли таблица называться `users` или `user` (Drizzle convention vs PostgreSQL convention)?
  - Решение задачи 3.2.2: единый snake_case множественное число (`users`, `accounts`, `sessions`).
