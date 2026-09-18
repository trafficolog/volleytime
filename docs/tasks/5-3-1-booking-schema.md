---
id: '5.3.1'
phase: '5'
epic: '5.3'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
  - DB
depends_on:
  - '5.2.1'
estimated_hours: '1'
tags:
  - drizzle
  - schema
  - bookings
---

# Task 5.3.1: Schema bookings + миграция

## Цель

Создать таблицу `bookings` — запись игрока на событие. Unique (event_id, user_id), статусы, method.

## Контекст

Booking связывает user и event. Ключевое: unique (event_id, user_id) — нельзя записаться дважды. Status определяет confirmed/waitlisted/cancelled. Method — технический код способа оплаты.

**Важно:** эту задачу делать ДО 5.2.3, потому что listing событий считает counts по bookings.

## Что должно быть сделано

1. **`packages/db/src/schema/bookings.ts`:**

   ```ts
   import { pgTable, serial, integer, timestamp, pgEnum, unique, index } from 'drizzle-orm/pg-core'
   import { events } from './events'
   import { users } from './users'
   import { organizations } from './organizations'

   export const bookingStatusEnum = pgEnum('booking_status', [
     'pending_payment', // записан, ждёт оплаты (слот занят)
     'confirmed', // подтверждён (оплачен или с абонемента)
     'waitlisted', // в листе ожидания (capacity заполнен)
     'attended', // пришёл
     'no_show', // не пришёл
     'cancelled', // отменён
   ])

   export const bookingMethodEnum = pgEnum('booking_method', [
     'subscription', // списание с абонемента
     'cash', // наличные (confirm в Phase 6)
     'transfer', // перевод (Phase 6)
     'online', // онлайн-оплата (Phase 12)
     'free', // бесплатное событие
   ])

   export const bookings = pgTable(
     'bookings',
     {
       id: serial('id').primaryKey(),
       eventId: integer('event_id')
         .notNull()
         .references(() => events.id, { onDelete: 'cascade' }),
       userId: integer('user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
       organizationId: integer('organization_id')
         .notNull()
         .references(() => organizations.id, { onDelete: 'cascade' }),
       status: bookingStatusEnum('status').notNull(),
       method: bookingMethodEnum('method').notNull(),
       subscriptionId: integer('subscription_id'), // FK добавится в 5.5.1 (если method=subscription)
       bookedAt: timestamp('booked_at', { withTimezone: true }).notNull().defaultNow(),
       confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
       cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
       updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       uniqueEventUser: unique('bookings_event_user_unique').on(t.eventId, t.userId),
       eventStatusIdx: index('bookings_event_status_idx').on(t.eventId, t.status),
       userIdx: index('bookings_user_idx').on(t.userId),
       waitlistOrderIdx: index('bookings_waitlist_order_idx').on(t.eventId, t.bookedAt),
     }),
   )

   export type Booking = typeof bookings.$inferSelect
   export type NewBooking = typeof bookings.$inferInsert
   ```

2. **Обновить `schema/index.ts`** + relations (events.bookings, bookings.event/user).

3. **Миграция:**
   ```bash
   pnpm db:generate && pnpm db:migrate
   ```

## Критерии приёмки

- ✅ Таблица bookings создана с enums status и method
- ✅ Unique (event_id, user_id) — нельзя записаться дважды (даже после cancel? см. подсказки)
- ✅ FK: event/user/org cascade
- ✅ Index (event_id, status) для подсчёта confirmed/waitlisted
- ✅ Index (event_id, booked_at) для waitlist FIFO order
- ✅ subscriptionId nullable integer (FK в 5.5.1)
- ✅ Миграция применяется

## Подсказки

- **Unique (event_id, user_id) и повторная запись после cancel:** unique constraint не позволит второй INSERT. Решение (как в Phase 4 members): reactivation — при повторной записи находим cancelled booking и UPDATE его обратно. BookingService.book (5.3.2) обрабатывает это.
- **waitlistOrderIdx (event_id, booked_at):** для FIFO promotion — первый waitlisted по времени записи. bookedAt не меняется при promotion (сохраняем порядок).
- **subscriptionId FK** добавится в 5.5.1 через ALTER. Пока integer column.
- **method=free** для бесплатных событий (price=0) — сразу confirmed без оплаты/абонемента.

## Не делать

- ❌ Не хранить slot_type (main/rotation) — отказались
- ❌ Не делать FK на subscription сейчас (таблицы нет) — 5.5.1
- ❌ Не делать payment_id — Phase 6
