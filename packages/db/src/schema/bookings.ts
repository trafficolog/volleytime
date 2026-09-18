import { index, integer, pgEnum, pgTable, serial, timestamp, unique } from 'drizzle-orm/pg-core'

import { events } from './events'
import { organizations } from './organizations'
import { subscriptions } from './subscriptions'
import { users } from './users'

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending_payment',
  'confirmed',
  'waitlisted',
  'attended',
  'no_show',
  'cancelled',
])

export const bookingMethodEnum = pgEnum('booking_method', [
  'subscription',
  'cash',
  'transfer',
  'online',
  'free',
])

export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    status: bookingStatusEnum('status').notNull(),
    method: bookingMethodEnum('method').notNull(),
    subscriptionId: integer('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),
    // FK → payments(id) ON DELETE SET NULL добавлен SQL-миграцией 0014 (цикл импортов bookings↔payments)
    paymentId: integer('payment_id'),
    bookedAt: timestamp('booked_at', { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('bookings_event_user_unique').on(t.eventId, t.userId),
    index('bookings_event_status_idx').on(t.eventId, t.status),
    index('bookings_user_idx').on(t.userId),
    index('bookings_waitlist_order_idx').on(t.eventId, t.bookedAt),
  ],
)

export type Booking = typeof bookings.$inferSelect
export type NewBooking = typeof bookings.$inferInsert
