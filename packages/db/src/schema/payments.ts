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

import { bookings } from './bookings'
import { organizations } from './organizations'
import { subscriptions } from './subscriptions'
import { users } from './users'

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'succeeded',
  'cancelled',
  'refunded',
])

export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'transfer', 'online'])

export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // polymorphic: ровно одно заполнено
    bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    subscriptionId: integer('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),
    amount: integer('amount').notNull(), // minor units
    currency: varchar('currency', { length: 8 }).notNull().default('BYN'),
    method: paymentMethodEnum('method').notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    confirmedByUserId: integer('confirmed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payments_org_status_idx').on(t.organizationId, t.status),
    index('payments_booking_idx').on(t.bookingId),
    index('payments_subscription_idx').on(t.subscriptionId),
    check('payments_amount_positive', sql`${t.amount} > 0`),
  ],
)

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
