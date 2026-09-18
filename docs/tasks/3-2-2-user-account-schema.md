---
id: '3.2.2'
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
  - '3.2.1'
estimated_hours: '2'
tags:
  - drizzle
  - schema
  - auth
---

# Task 3.2.2: User + Account schema (для better-auth)

## Цель

Создать первый набор моделей Drizzle: `users`, `accounts`, `sessions`, `verification_tokens`. Этот минимум нужен для better-auth.

## Контекст

better-auth требует свою схему таблиц (а также может расширять). Мы создаём базовые таблицы, совместимые с дефолтным better-auth schema, плюс наши специфичные поля для Volley Time.

Ключевые особенности:

- `users` — глобальный (один пользователь = один аккаунт на платформе)
- `accounts` — связь User с identity-provider'ом (email, telegram)
- Один user может иметь несколько accounts (email + telegram одновременно)
- `sessions` — активные сессии (cookies)
- `verification_tokens` — для email-code (6-значный код, TTL 10 мин)

## Что должно быть сделано

1. **`packages/db/src/schema/users.ts`:**

   ```ts
   import { pgTable, serial, text, bigint, timestamp, boolean } from 'drizzle-orm/pg-core'

   export const users = pgTable('users', {
     id: serial('id').primaryKey(),
     email: text('email').unique(),
     emailVerified: boolean('email_verified').notNull().default(false),
     name: text('name'),
     telegramUserId: bigint('telegram_user_id', { mode: 'bigint' }).unique(),
     telegramUsername: text('telegram_username'),
     phone: text('phone'),
     image: text('image'),
     isActive: boolean('is_active').notNull().default(true),
     isRootAdmin: boolean('is_root_admin').notNull().default(false),
     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
     updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   })

   export type User = typeof users.$inferSelect
   export type NewUser = typeof users.$inferInsert
   ```

2. **`packages/db/src/schema/accounts.ts`:**

   ```ts
   import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core'
   import { users } from './users'

   export const accounts = pgTable(
     'accounts',
     {
       id: serial('id').primaryKey(),
       userId: integer('user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
       providerId: text('provider_id').notNull(), // 'email', 'telegram'
       accountId: text('account_id').notNull(), // email-адрес или telegram_user_id как string
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
       updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       uniqueProviderAccount: unique().on(t.providerId, t.accountId),
     }),
   )

   export type Account = typeof accounts.$inferSelect
   ```

3. **`packages/db/src/schema/sessions.ts`:**

   ```ts
   import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core'
   import { users } from './users'

   export const sessions = pgTable('sessions', {
     id: serial('id').primaryKey(),
     userId: integer('user_id')
       .notNull()
       .references(() => users.id, { onDelete: 'cascade' }),
     token: text('token').notNull().unique(),
     expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
     ipAddress: text('ip_address'),
     userAgent: text('user_agent'),
     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   })

   export type Session = typeof sessions.$inferSelect
   ```

4. **`packages/db/src/schema/verification.ts`:**

   ```ts
   import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core'

   export const verificationTokens = pgTable('verification_tokens', {
     id: serial('id').primaryKey(),
     identifier: text('identifier').notNull(), // email
     code: text('code').notNull(), // 6-значный код
     attempts: integer('attempts').notNull().default(0),
     expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   })

   export type VerificationToken = typeof verificationTokens.$inferSelect
   ```

5. **`packages/db/src/schema/index.ts`** — экспорт всего:

   ```ts
   export * from './users'
   export * from './accounts'
   export * from './sessions'
   export * from './verification'
   ```

6. **Relations (для Drizzle relational queries):**
   ```ts
   // packages/db/src/schema/relations.ts
   import { relations } from 'drizzle-orm'
   import { users, accounts, sessions } from './'

   export const usersRelations = relations(users, ({ many }) => ({
     accounts: many(accounts),
     sessions: many(sessions),
   }))

   export const accountsRelations = relations(accounts, ({ one }) => ({
     user: one(users, { fields: [accounts.userId], references: [users.id] }),
   }))

   export const sessionsRelations = relations(sessions, ({ one }) => ({
     user: one(users, { fields: [sessions.userId], references: [users.id] }),
   }))
   ```

## Критерии приёмки

- ✅ TypeScript типы корректные: `User`, `NewUser`, `Account`, `Session`, `VerificationToken`
- ✅ Drizzle студия (`pnpm db:studio`) видит все 4 таблицы (после миграции в 3.2.3)
- ✅ Relations работают: `db.query.users.findFirst({ with: { accounts: true } })` возвращает user с массивом accounts
- ✅ Уникальные constraints на: `users.email`, `users.telegram_user_id`, `accounts (provider_id, account_id)`, `sessions.token`
- ✅ Cascade delete: при удалении user — каскадно удаляются его accounts и sessions

## Подсказки

- **Названия колонок в БД — snake_case, в TS — camelCase.** Drizzle сам преобразует, если явно указать через `.notNull().default(false)`.
- **`bigint`** для `telegram_user_id` — потому что Telegram ID может превышать 2^31. Mode `'bigint'` гарантирует правильный возврат как BigInt в JS.
- **`withTimezone: true`** для всех timestamp — важно, чтобы Drizzle хранил `timestamptz`, не `timestamp`.
- **Когда добавим `multi-tenancy` в Phase 4** — user.id остаётся глобальным, добавится таблица `organization_members` с FK на users и organizations.

## Не делать

- ❌ Не создавать Organization, Event, Booking — это Phase 4-5
- ❌ Не добавлять поля типа `password_hash` — passwordless only
- ❌ Не делать sharding или partitioning — не нужно
- ❌ Не создавать индексы кроме PK и FK + явных unique — производительность в Phase 5+ когда увидим query patterns
