import { index, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

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
    status: venueStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('venues_org_idx').on(t.organizationId)],
)

export type Venue = typeof venues.$inferSelect
export type NewVenue = typeof venues.$inferInsert
