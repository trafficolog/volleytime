---
id: '6.1.1'
phase: '6'
epic: '6.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
  - DB
depends_on:
  - '5.3.1'
  - '5.5.1'
estimated_hours: '1'
tags:
  - drizzle
  - schema
  - payments
---

# Task 6.1.1: Schema payments + миграция

## Цель

Таблица `payments` — polymorphic (booking_id ИЛИ subscription_id), append-only. ALTER для booking.payment_id FK.

## Контекст

Payment фиксирует факт оплаты. Polymorphic: одна запись покрывает либо booking (разовая оплата события), либо subscription (покупка абонемента). Решение 1: ровно одно из booking_id/subscription_id заполнено.

## Что должно быть сделано

1. **`packages/db/src/schema/payments.ts`:**

   ```ts
   import {
     pgTable,
     serial,
     integer,
     text,
     timestamp,
     pgEnum,
     varchar,
     index,
   } from 'drizzle-orm/pg-core'
   import { organizations } from './organizations'
   import { users } from './users'
   import { bookings } from './bookings'
   import { subscriptions } from './subscriptions'

   export const paymentStatusEnum = pgEnum('payment_status', [
     'pending', // создан, ждёт подтверждения организатором
     'succeeded', // подтверждён (деньги получены)
     'cancelled', // отклонён до оплаты
     'refunded', // возвращён после succeeded
   ])

   export const paymentMethodEnum = pgEnum('payment_method', [
     'cash', // наличные
     'transfer', // банковский перевод
     'online', // онлайн (Phase 12)
   ])

   export const payments = pgTable(
     'payments',
     {
       id: serial('id').primaryKey(),
       organizationId: integer('organization_id')
         .notNull()
         .references(() => organizations.id, { onDelete: 'cascade' }),
       userId: integer('user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
       // polymorphic: ровно одно заполнено
       bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
       subscriptionId: integer('subscription_id').references(() => subscriptions.id, {
         onDelete: 'set null',
       }),
       amount: integer('amount').notNull(), // мин. единицы (копейки), как event.price
       currency: varchar('currency', { length: 8 }).notNull().default('BYN'),
       method: paymentMethodEnum('method').notNull(),
       status: paymentStatusEnum('status').notNull().default('pending'),
       // трассировка
       confirmedByUserId: integer('confirmed_by_user_id').references(() => users.id, {
         onDelete: 'set null',
       }),
       confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
       refundedAt: timestamp('refunded_at', { withTimezone: true }),
       note: text('note'),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       orgStatusIdx: index('payments_org_status_idx').on(t.organizationId, t.status),
       pendingIdx: index('payments_pending_idx')
         .on(t.organizationId)
         .where(sql`status = 'pending'`),
       bookingIdx: index('payments_booking_idx').on(t.bookingId),
       subscriptionIdx: index('payments_subscription_idx').on(t.subscriptionId),
     }),
   )

   export type Payment = typeof payments.$inferSelect
   export type NewPayment = typeof payments.$inferInsert
   ```

   Импорт `sql` для partial index: `import { sql } from 'drizzle-orm'`.

2. **ALTER booking.payment_id** — обновить `bookings.ts`:

   ```ts
   import { payments } from './payments'
   // в bookings pgTable:
   paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
   ```

   ВАЖНО: bookings и payments ссылаются друг на друга. Drizzle сгенерирует ALTER после CREATE обеих таблиц. Если циклическая FK мешает миграции — добавить payment_id в bookings отдельным ALTER-шагом (Drizzle обычно справляется).

3. **Schema index + relations:**

   ```ts
   export const paymentsRelations = relations(payments, ({ one }) => ({
     organization: one(organizations, {
       fields: [payments.organizationId],
       references: [organizations.id],
     }),
     user: one(users, { fields: [payments.userId], references: [users.id] }),
     booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
     subscription: one(subscriptions, {
       fields: [payments.subscriptionId],
       references: [subscriptions.id],
     }),
   }))
   ```

4. **Миграция:**
   ```bash
   pnpm db:generate && pnpm db:migrate
   ```

## Критерии приёмки

- ✅ Таблица payments с enums status (4) и method (3)
- ✅ Polymorphic: booking_id и subscription_id оба nullable
- ✅ amount в минимальных единицах (как event.price)
- ✅ FK: org/user cascade, booking/subscription set null
- ✅ confirmedByUserId — кто подтвердил (трассировка)
- ✅ Partial index на pending (быстрый список ожидающих)
- ✅ ALTER добавил booking.payment_id
- ✅ Миграция применяется

## Подсказки

- **Polymorphic constraint:** «ровно одно заполнено» можно добавить CHECK constraint:
  `CHECK ((booking_id IS NOT NULL)::int + (subscription_id IS NOT NULL)::int = 1)`.
  Drizzle поддерживает через `sql` в table extra config или вручную в миграции. Минимум — валидация в сервисе (6.1.2).
- **Циклическая FK bookings↔payments:** booking.payment_id → payment, payment.booking_id → booking. Оба set null. Drizzle создаёт таблицы, потом ALTER FK. Если генератор ругается — payment_id в bookings вынести в отдельную миграцию.
- **amount в минимальных единицах** — консистентно с event.price/plan.price (5.2.1, 5.4.1).
- **Partial index pending** — список pending-платежей частый запрос (UI 6.5), индекс ускоряет.

## Не делать

- ❌ Не хранить amount как float — integer минимальные единицы
- ❌ Не делать редактирование (append-only) — refund отдельной записью/статусом
- ❌ Не добавлять bepaid поля — Phase 12
- ❌ Не делать оба FK заполненными (polymorphic = ровно одно)
