---
id: '5.5.1'
phase: '5'
epic: '5.5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - BACK
  - DB
depends_on:
  - '5.4.1'
  - '5.3.1'
estimated_hours: '1'
tags:
  - drizzle
  - schema
  - subscriptions
---

# Task 5.5.1: Schema subscriptions + миграция

## Цель

Таблица `subscriptions` — купленный игроком абонемент. Плюс ALTER для FK bookings.subscription_id → subscriptions.id.

## Контекст

Subscription создаётся на основе plan, привязан к user+org. Хранит total/used сессии, expires_at, status. consume увеличивает used атомарно.

## Что должно быть сделано

1. **`packages/db/src/schema/subscriptions.ts`:**

   ```ts
   import { pgTable, serial, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
   import { subscriptionPlans } from './subscription-plans'
   import { users } from './users'
   import { organizations } from './organizations'

   export const subscriptionStatusEnum = pgEnum('subscription_status', [
     'pending', // создан, ждёт оплаты/активации
     'active', // активен, можно списывать
     'exhausted', // used == total
     'expired', // expires_at прошёл
     'cancelled', // отменён
   ])

   export const subscriptions = pgTable(
     'subscriptions',
     {
       id: serial('id').primaryKey(),
       organizationId: integer('organization_id')
         .notNull()
         .references(() => organizations.id, { onDelete: 'cascade' }),
       userId: integer('user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
       planId: integer('plan_id')
         .notNull()
         .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
       totalSessions: integer('total_sessions').notNull(), // snapshot из plan на момент покупки
       usedSessions: integer('used_sessions').notNull().default(0),
       status: subscriptionStatusEnum('status').notNull().default('pending'),
       purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
       activatedAt: timestamp('activated_at', { withTimezone: true }),
       expiresAt: timestamp('expires_at', { withTimezone: true }), // null = бессрочно; set при активации
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
       updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       userOrgIdx: index('subscriptions_user_org_idx').on(t.userId, t.organizationId),
       // для FIFO selection: active subs пользователя, сортировка по expiresAt
       fifoIdx: index('subscriptions_fifo_idx').on(
         t.userId,
         t.organizationId,
         t.status,
         t.expiresAt,
       ),
     }),
   )

   export type Subscription = typeof subscriptions.$inferSelect
   export type NewSubscription = typeof subscriptions.$inferInsert
   ```

2. **ALTER: добавить FK bookings.subscription_id:**
   Обновить `bookings.ts`:

   ```ts
   import { subscriptions } from './subscriptions'
   // в pgTable bookings:
   subscriptionId: integer('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
   ```

3. **Schema index + relations** (subscription.plan/user, booking.subscription).

4. **Миграция:**
   ```bash
   pnpm db:generate && pnpm db:migrate
   ```

## Критерии приёмки

- ✅ Таблица subscriptions создана с status enum
- ✅ FK: org/user cascade, plan restrict (план с subscriptions не удаляется физически — но мы archive)
- ✅ totalSessions snapshot (не FK-зависит от plan после покупки)
- ✅ usedSessions default 0
- ✅ FIFO index (user, org, status, expiresAt) — для быстрого выбора
- ✅ ALTER добавил bookings.subscription_id FK
- ✅ Миграция применяется

## Подсказки

- **totalSessions snapshot:** копируем из plan при покупке. Если plan потом изменят — у купленного абонемента остаётся своё количество. Это правильно (купил 8 — имеешь 8).
- **expiresAt set при активации, не при создании:** срок начинается с момента оплаты/активации (5.5.2). pending subscription без expiresAt.
- **FIFO index** покрывает запрос «active subs юзера в org, сортировка по expiresAt ASC».
- **plan onDelete restrict** — но мы plans не удаляем физически (archive). Restrict — защита от случайного.

## Не делать

- ❌ Не делать negative usedSessions
- ❌ Не хранить remaining (вычисляем total - used)
- ❌ Не делать freeze/pause поля — Phase 14+
