import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { bookings } from './bookings'
import { events } from './events'
import { organizations } from './organizations'

export const waitlistOfferStatusEnum = pgEnum('waitlist_offer_status', [
  'offered',
  'accepted',
  'declined',
  'expired',
  'revoked',
])

/**
 * Предложение освободившихся мест первому в листе ожидания с TTL 30 мин (20.3.1, D-03, ADR v3).
 * Места под активным предложением считаются занятыми при подсчёте свободных. Переходы — только из
 * `offered` условным UPDATE, поэтому повтор задачи истечения безопасен.
 */
export const waitlistOffers = pgTable(
  'waitlist_offers',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    bookingId: integer('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    seats: integer('seats').notNull(),
    status: waitlistOfferStatusEnum('status').notNull().default('offered'),
    offeredAt: timestamp('offered_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    // не больше одного активного предложения на запись
    uniqueIndex('waitlist_offers_active_booking_uniq')
      .on(t.bookingId)
      .where(sql`${t.status} = 'offered'`),
    index('waitlist_offers_event_status_idx').on(t.eventId, t.status),
    index('waitlist_offers_due_idx')
      .on(t.expiresAt)
      .where(sql`${t.status} = 'offered'`),
    check('waitlist_offers_seats_positive', sql`${t.seats} >= 1`),
    check('waitlist_offers_expires_after_offer', sql`${t.expiresAt} > ${t.offeredAt}`),
  ],
)

export type WaitlistOffer = typeof waitlistOffers.$inferSelect
