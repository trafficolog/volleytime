import { sql } from 'drizzle-orm'
import {
  bigserial,
  check,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './users'

/**
 * События функций игрока (23.1.2, P-14, D-25): открытие (`open`) и использование (`use`) одной из
 * восьми функций. Одно событие вида на игрока, функцию и сутки UTC (`day`): повтор не пишется,
 * поэтому таблица растёт не больше чем на 16 строк на игрока в сутки. Хранится 180 дней, старше
 * удаляет планировщик. Отчёт читает только агрегаты по платформе.
 */
export const featureEvents = pgTable(
  'feature_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    feature: varchar('feature', { length: 16 }).notNull(),
    kind: varchar('kind', { length: 8 }).notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('feature_events_user_feature_kind_day_uq').on(t.userId, t.feature, t.kind, t.day),
    index('feature_events_feature_created_idx').on(t.feature, t.createdAt),
    index('feature_events_created_idx').on(t.createdAt),
    check(
      'feature_events_feature_chk',
      sql`${t.feature} IN ('cal', 'coach', 'warmup', 'self', 'mvp', 'teams', 'streak', 'wrapped')`,
    ),
    check('feature_events_kind_chk', sql`${t.kind} IN ('open', 'use')`),
  ],
)

export type FeatureEvent = typeof featureEvents.$inferSelect
