---
id: '4.1.1'
phase: '4'
epic: '4.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
  - DB
depends_on:
  - '3.2.3'
estimated_hours: '1'
tags:
  - drizzle
  - schema
  - organizations
---

# Task 4.1.1: Drizzle schema organizations + миграция

## Цель

Создать Drizzle schema для `organizations` таблицы согласно DOMAIN.md. Сгенерировать миграцию через `drizzle-kit generate`.

## Контекст

Это первая бизнес-сущность платформы. С этой таблицы начинается multi-tenancy: все последующие сущности будут иметь `organization_id` FK сюда.

## Что должно быть сделано

1. **`packages/db/src/schema/organizations.ts`:**

   ```ts
   import { pgTable, serial, text, integer, timestamp, pgEnum, varchar } from 'drizzle-orm/pg-core'
   import { users } from './users'

   export const orgStatusEnum = pgEnum('organization_status', ['active', 'suspended', 'archived'])
   export const memberStatusDefaultEnum = pgEnum('member_status_default', ['active', 'pending'])

   export const organizations = pgTable(
     'organizations',
     {
       id: serial('id').primaryKey(),
       slug: varchar('slug', { length: 64 }).notNull().unique(),
       name: text('name').notNull(),
       description: text('description'),
       city: text('city'),
       sportType: varchar('sport_type', { length: 32 }).notNull().default('volleyball'),
       ownerUserId: integer('owner_user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'restrict' }),
       status: orgStatusEnum('status').notNull().default('active'),
       defaultMemberStatus: memberStatusDefaultEnum('default_member_status')
         .notNull()
         .default('active'),
       defaultCurrency: varchar('default_currency', { length: 8 }).notNull().default('BYN'),
       defaultTimezone: varchar('default_timezone', { length: 64 })
         .notNull()
         .default('Europe/Minsk'),
       publicPageEnabled: integer('public_page_enabled').notNull().default(0), // 0 = off, 1 = on
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
       updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       ownerIdx: index('organizations_owner_idx').on(t.ownerUserId),
       statusIdx: index('organizations_status_idx').on(t.status),
     }),
   )

   export type Organization = typeof organizations.$inferSelect
   export type NewOrganization = typeof organizations.$inferInsert
   ```

   Импорт `index` и `unique`:

   ```ts
   import {
     pgTable,
     serial,
     text,
     integer,
     timestamp,
     pgEnum,
     varchar,
     index,
   } from 'drizzle-orm/pg-core'
   ```

2. **Обновить `packages/db/src/schema/index.ts`:**

   ```ts
   export * from './users'
   export * from './accounts'
   export * from './sessions'
   export * from './verification'
   export * from './organizations' // NEW
   ```

3. **`packages/db/src/schema/relations.ts`** — добавить relations:

   ```ts
   import { relations } from 'drizzle-orm'
   import { users } from './users'
   import { organizations } from './organizations'

   export const usersRelations = relations(users, ({ many, one }) => ({
     accounts: many(accounts),
     sessions: many(sessions),
     ownedOrganizations: many(organizations, { relationName: 'owner' }),
   }))

   export const organizationsRelations = relations(organizations, ({ one }) => ({
     owner: one(users, {
       fields: [organizations.ownerUserId],
       references: [users.id],
       relationName: 'owner',
     }),
   }))
   ```

4. **Сгенерировать миграцию:**

   ```bash
   pnpm db:generate
   ```

   Должен появиться файл `packages/db/migrations/0001_<random_name>.sql` с CREATE TABLE и CREATE TYPE для enums.

5. **Применить миграцию:**

   ```bash
   pnpm db:migrate
   ```

6. **Проверить через Drizzle Studio:**
   ```bash
   pnpm db:studio
   ```
   Таблица `organizations` должна появиться, типы enums тоже.

## Критерии приёмки

- ✅ Файл `packages/db/src/schema/organizations.ts` создан с корректными типами
- ✅ Enums `organization_status` и `member_status_default` создаются в БД
- ✅ Уникальный constraint на `slug` создан
- ✅ FK `owner_user_id → users.id` с `onDelete: 'restrict'` (нельзя удалить user-owner)
- ✅ Indexes на `owner_user_id` и `status` созданы
- ✅ Drizzle Studio показывает таблицу со всеми полями
- ✅ `pnpm typecheck` проходит — типы `Organization` и `NewOrganization` экспортированы
- ✅ Миграция воспроизводима: `db:drop && db:migrate` восстанавливает схему

## Подсказки

- **`onDelete: 'restrict'`** — нельзя удалить user'a если он owner какой-то organization. Это защищает от orphaned organizations.
- **`varchar(64)` для slug** — достаточно для URL slug. text был бы overkill.
- **`publicPageEnabled: integer (0/1)`** — Drizzle на момент 2026-05 имеет нюансы с boolean default в pgEnum/migrations. Integer 0/1 работает консистентно. Можно использовать `boolean` если в твоей версии Drizzle всё ок.
- **Enums в PostgreSQL** — после `db:migrate` они создаются как `CREATE TYPE`. При drop таблицы тип остаётся — это нормально, Drizzle переиспользует.
- **Relations можно добавить позже** — но лучше сразу, иначе Drizzle query API (`db.query.organizations.findFirst({ with: { owner: true } })`) не будет работать.

## Не делать

- ❌ Не добавлять `bepaid_credentials_encrypted` поле — это Phase 13
- ❌ Не добавлять `public_token` для public link — Phase 11 (contributions/public pages)
- ❌ Не делать индекс на slug — он уже unique, отдельный index не нужен
- ❌ Не использовать UUID для id — serial быстрее и достаточен для MVP
- ❌ Не делать physical delete cascade — мы используем soft-delete (status=archived)
