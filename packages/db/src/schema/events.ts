import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import { eventJoinModeEnum, eventPriceModeEnum } from './event-enums'
import { eventSeries } from './event-series'
import { playerLevelEnum } from './level-enums'
import { organizations } from './organizations'
import { playerLevels } from './player-levels'
import { users } from './users'
import { venues } from './venues'

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
    locationText: text('location_text'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    capacity: integer('capacity').notNull(),
    price: integer('price').notNull().default(0), // minor units
    priceMode: eventPriceModeEnum('price_mode').notNull().default('fixed'),
    targetAmount: integer('target_amount'), // minor units, split only
    pricingSettledAt: timestamp('pricing_settled_at', { withTimezone: true }),
    pricingParticipantCount: integer('pricing_participant_count'),
    currency: varchar('currency', { length: 8 }).notNull().default('BYN'),
    cancellationDeadlineHours: integer('cancellation_deadline_hours'),
    // снимок политики группы при создании (D-02, 19.2.2); у существующих событий true
    cancellationAllowed: boolean('cancellation_allowed').notNull().default(true),
    // требуемый уровень события (19.2.3); NULL — для любого
    // режим записи (20.1.3): снимок `organizations.default_join_mode` при создании; `invite` —
    // запись только по приглашению (проверка в сервисе записи под lock события)
    joinMode: eventJoinModeEnum('join_mode').notNull().default('open'),
    level: playerLevelEnum('level').references(() => playerLevels.code, { onDelete: 'restrict' }),
    status: eventStatusEnum('status').notNull().default('published'),
    // дата серии (20.2.2): календарная дата в зоне группы; удаление серии оставляет событие
    seriesId: integer('series_id').references(() => eventSeries.id, { onDelete: 'set null' }),
    seriesDate: date('series_date', { mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('events_org_starts_idx').on(t.organizationId, t.startsAt),
    index('events_status_idx').on(t.status),
    index('events_venue_idx').on(t.venueId),
    check('events_capacity_positive', sql`${t.capacity} > 0`),
    check('events_price_non_negative', sql`${t.price} >= 0`),
    check(
      'events_pricing_mode_consistent',
      sql`(${t.priceMode} = 'fixed' AND ${t.targetAmount} IS NULL AND ${t.pricingSettledAt} IS NULL AND ${t.pricingParticipantCount} IS NULL) OR (${t.priceMode} = 'split' AND ${t.price} = 0 AND ${t.targetAmount} IS NOT NULL AND ${t.targetAmount} > 0)`,
    ),
    check(
      'events_pricing_settlement_pair',
      sql`(${t.pricingSettledAt} IS NULL AND ${t.pricingParticipantCount} IS NULL) OR (${t.pricingSettledAt} IS NOT NULL AND ${t.pricingParticipantCount} IS NOT NULL AND ${t.pricingParticipantCount} > 0)`,
    ),
    check('events_ends_after_start', sql`${t.endsAt} > ${t.startsAt}`),
    // одна дата серии — одно событие; событие серии всегда с датой
    uniqueIndex('events_series_date_uniq').on(t.seriesId, t.seriesDate),
    check('events_series_date_required', sql`${t.seriesId} IS NULL OR ${t.seriesDate} IS NOT NULL`),
  ],
)

export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
