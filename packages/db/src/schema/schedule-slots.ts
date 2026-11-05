import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

import { eventTypeEnum } from './events'
import { organizations } from './organizations'
import { venues } from './venues'

/**
 * Слот расписания группы (21.2.12, W-11): регулярное время тренировки. Шаблон только заполняет
 * форму создания события и серии; события по слотам автоматически не создаются и баланс не
 * списывается. `weekday` — ISO (1 = понедельник), `start_time` — `HH:MM` по часам группы, как
 * `template.startTime` серии. `venue_id` — зал той же группы (проверяет сервис); при физическом
 * удалении зала слот остаётся без зала.
 */
export const scheduleSlots = pgTable(
  'schedule_slots',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(120),
    title: text('title').notNull(),
    type: eventTypeEnum('type').notNull().default('training'),
    venueId: integer('venue_id').references(() => venues.id, { onDelete: 'set null' }),
    capacity: integer('capacity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('schedule_slots_org_idx').on(t.organizationId, t.weekday, t.startTime),
    check('schedule_slots_weekday_chk', sql`${t.weekday} BETWEEN 1 AND 7`),
    check('schedule_slots_start_time_chk', sql`${t.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
    check('schedule_slots_duration_chk', sql`${t.durationMinutes} BETWEEN 15 AND 1440`),
    check('schedule_slots_capacity_chk', sql`${t.capacity} BETWEEN 1 AND 500`),
    check('schedule_slots_title_chk', sql`char_length(btrim(${t.title})) BETWEEN 2 AND 200`),
    check('schedule_slots_type_chk', sql`${t.type} <> 'tournament_match'`),
  ],
)

export type ScheduleSlot = typeof scheduleSlots.$inferSelect
export type NewScheduleSlot = typeof scheduleSlots.$inferInsert
