import { sql } from 'drizzle-orm'
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { users } from './users'

export const eventSeriesStatusEnum = pgEnum('event_series_status', ['active', 'ended'])

/**
 * Серия событий (20.2.2, ADR v3 «Серии и черновики», D-04). Каждая дата серии — обычная строка
 * `events` (`series_id`, `series_date`): календари, запись и цена читают события, не серию.
 * `rule`/`template` валидирует zod-схема core; `timezone` — снимок `organizations.default_timezone`.
 * `idempotency_key` — повтор того же запроса создания возвращает уже созданную серию.
 */
export const eventSeries = pgTable(
  'event_series',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    rule: jsonb('rule').notNull(),
    exceptions: date('exceptions', { mode: 'string' })
      .array()
      .notNull()
      .default(sql`'{}'::date[]`),
    template: jsonb('template').notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull(),
    status: eventSeriesStatusEnum('status').notNull().default('active'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('event_series_org_idx').on(t.organizationId, t.createdAt),
    uniqueIndex('event_series_idempotency_uniq')
      .on(t.organizationId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
  ],
)

export type EventSeries = typeof eventSeries.$inferSelect
export type NewEventSeries = typeof eventSeries.$inferInsert
