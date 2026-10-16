import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { events } from './events'
import { organizations } from './organizations'

export const scheduledJobStatusEnum = pgEnum('scheduled_job_status', [
  'pending',
  'running',
  'done',
  'skipped',
  'failed',
])

/**
 * Журнал выполнений фоновых задач события (20.3.1): очередь и outbox уведомлений планировщика.
 * `dedup_key` UNIQUE — одна задача на ключ навсегда (повтор постановки — no-op), поэтому повторный
 * проход планировщика не дублирует уведомления. Захват — `FOR UPDATE SKIP LOCKED` с арендой
 * `locked_until`: несколько экземпляров не берут одну строку, задачу упавшего экземпляра
 * подхватывают после истечения аренды. Сбой доставки — `pending` с отложенным `run_at` (backoff),
 * после исчерпания попыток — `failed` с `last_error`.
 */
export const scheduledJobs = pgTable(
  'scheduled_jobs',
  {
    id: serial('id').primaryKey(),
    kind: text('kind').notNull(),
    dedupKey: text('dedup_key').notNull(),
    organizationId: integer('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').notNull().default({}),
    status: scheduledJobStatusEnum('status').notNull().default('pending'),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastError: text('last_error'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('scheduled_jobs_dedup_uniq').on(t.dedupKey),
    index('scheduled_jobs_due_idx')
      .on(t.runAt)
      .where(sql`${t.status} IN ('pending', 'running')`),
    index('scheduled_jobs_event_idx').on(t.eventId),
    index('scheduled_jobs_completed_idx')
      .on(t.completedAt)
      .where(sql`${t.status} IN ('done', 'skipped', 'failed')`),
    check('scheduled_jobs_attempts_non_negative', sql`${t.attempts} >= 0`),
  ],
)

export type ScheduledJob = typeof scheduledJobs.$inferSelect
