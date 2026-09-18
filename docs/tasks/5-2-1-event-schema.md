---
id: '5.2.1'
phase: '5'
epic: '5.2'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - BACK
  - DB
depends_on:
  - '5.1.1'
estimated_hours: '1'
tags:
  - drizzle
  - schema
  - events
---

# Task 5.2.1: Schema events + миграция

## Цель

Создать таблицу `events` — центральную сущность Phase 5. Capacity + cancellation deadline + status lifecycle.

## Контекст

Event — то, на что записываются игроки. Решения: type training/open_game (идентичны по поведению), единый capacity (без main/rotation), cancellation_deadline_hours настраивается организатором, venue опционально.

Event хранит только метаданные и capacity. Распределение слотов (кто confirmed, кто waitlisted) — в bookings (5.3), вычисляется по COUNT.

## Что должно быть сделано

1. **`packages/db/src/schema/events.ts`:**

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
   import { venues } from './venues'
   import { users } from './users'

   export const eventTypeEnum = pgEnum('event_type', [
     'training',
     'open_game',
     'tournament_match',
     'custom',
   ])
   export const eventStatusEnum = pgEnum('event_status', [
     'draft',
     'published',
     'closed',
     'finished',
     'cancelled',
   ])

   export const events = pgTable(
     'events',
     {
       id: serial('id').primaryKey(),
       organizationId: integer('organization_id')
         .notNull()
         .references(() => organizations.id, { onDelete: 'cascade' }),
       venueId: integer('venue_id').references(() => venues.id, { onDelete: 'set null' }),
       createdByUserId: integer('created_by_user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'restrict' }),
       type: eventTypeEnum('type').notNull().default('training'),
       title: text('title').notNull(),
       description: text('description'),
       locationText: text('location_text'), // всегда, даже если venueId задан (snapshot/override)
       startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
       endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
       capacity: integer('capacity').notNull(), // макс confirmed; сверх — waitlist
       price: integer('price').notNull().default(0), // в минимальных единицах (копейки/центы), 0 = бесплатно
       currency: varchar('currency', { length: 8 }).notNull().default('BYN'),
       cancellationDeadlineHours: integer('cancellation_deadline_hours'), // null = без дедлайна
       status: eventStatusEnum('status').notNull().default('published'),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
       updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       orgStartsIdx: index('events_org_starts_idx').on(t.organizationId, t.startsAt),
       statusIdx: index('events_status_idx').on(t.status),
     }),
   )

   export type Event = typeof events.$inferSelect
   export type NewEvent = typeof events.$inferInsert
   ```

2. **Обновить `schema/index.ts`** + **relations:**

   ```ts
   export const eventsRelations = relations(events, ({ one, many }) => ({
     organization: one(organizations, {
       fields: [events.organizationId],
       references: [organizations.id],
     }),
     venue: one(venues, { fields: [events.venueId], references: [venues.id] }),
     createdBy: one(users, { fields: [events.createdByUserId], references: [users.id] }),
     // bookings: many(bookings) — добавится в 5.3.1
   }))
   ```

3. **Миграция:**
   ```bash
   pnpm db:generate && pnpm db:migrate
   ```

## Критерии приёмки

- ✅ Таблица events создана с enums type и status
- ✅ FK: organization (cascade), venue (set null — venue может быть удалён), createdBy (restrict)
- ✅ capacity NOT NULL, price default 0 (поддержка бесплатных событий)
- ✅ cancellationDeadlineHours nullable (null = без дедлайна)
- ✅ Index на (organization_id, starts_at) для листинга
- ✅ Relations работают
- ✅ Миграция применяется и откатывается

## Подсказки

- **price в минимальных единицах (integer):** храним 1500 = 15.00 BYN. Избегаем float для денег. UI делит на 100 для отображения. Это стандарт для финансов.
- **locationText всегда:** даже при venueId. Это snapshot адреса на момент события (venue может измениться/удалиться) + возможность override. При создании можно автозаполнить из venue.address.
- **endsAt:** для расчёта «событие finished» и для UI. Не enforced что endsAt > startsAt в БД — валидация в EventService.
- **status default published:** в MVP создаём сразу published (без draft workflow). draft в enum для будущего.

## Не делать

- ❌ Не делать main/rotation поля — только capacity
- ❌ Не делать recurring (rrule) поля — Phase 15
- ❌ Не делать связь с matches — Phase 16
- ❌ Не хранить confirmed_count в таблице — вычисляем по COUNT bookings (избегаем рассинхрона)
