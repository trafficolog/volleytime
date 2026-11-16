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
} from 'drizzle-orm/pg-core'

import { organizations } from './organizations'

export const venueStatusEnum = pgEnum('venue_status', ['active', 'archived'])

export const venues = pgTable(
  'venues',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address'),
    capacityHint: integer('capacity_hint'),
    notes: text('notes'),
    /**
     * Цена часа аренды в минимальных единицах валюты группы (21.4.13, DEF-23); `null` — не указана.
     * Справочная: в цену события, кассу и отчёты не входит (ADR-21-4-13).
     */
    hourlyPrice: integer('hourly_price'),
    status: venueStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('venues_org_idx').on(t.organizationId),
    check(
      'venues_hourly_price_range',
      sql`${t.hourlyPrice} IS NULL OR ${t.hourlyPrice} BETWEEN 0 AND 10000000`,
    ),
  ],
)

export type Venue = typeof venues.$inferSelect
export type NewVenue = typeof venues.$inferInsert
