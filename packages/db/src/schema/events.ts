import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
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
export const eventPriceModeEnum = pgEnum('event_price_mode', ['fixed', 'split'])

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
    status: eventStatusEnum('status').notNull().default('published'),
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
  ],
)

export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
