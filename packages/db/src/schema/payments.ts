import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
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

import { bookings } from './bookings'
import { collections } from './collections'
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
    // взнос в сбор (21.2.4): составной FK (collection_id, organization_id) — сбор своей группы
    collectionId: integer('collection_id'),
    // воплощение записи на момент создания платежа (20.1.2): живые платежи записи —
    // booking_incarnation = bookings.incarnation, seat_released_at IS NULL, pending/succeeded
    bookingIncarnation: integer('booking_incarnation'),
    // оплаченное место освобождено игроком без возврата (D-14): платёж остаётся succeeded
    seatReleasedAt: timestamp('seat_released_at', { withTimezone: true }),
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
    index('payments_booking_incarnation_idx').on(t.bookingId, t.bookingIncarnation),
    index('payments_subscription_idx').on(t.subscriptionId),
    index('payments_collection_idx').on(t.collectionId, t.status),
    // NO ACTION, а не RESTRICT: удаление группы каскадом снимает и сборы, и их платежи одной командой
    foreignKey({
      name: 'payments_collection_org_fk',
      columns: [t.collectionId, t.organizationId],
      foreignColumns: [collections.id, collections.organizationId],
    }),
    // у платежа не больше одной цели: запись, абонемент или сбор (ADR v3 «Сборы»)
    check(
      'payments_single_target',
      sql`num_nonnulls(${t.bookingId}, ${t.subscriptionId}, ${t.collectionId}) <= 1`,
    ),
    // одно ожидающее обещание игрока в сборе: повторный взнос меняет сумму, а не плодит строки
    uniqueIndex('payments_collection_pending_uniq')
      .on(t.collectionId, t.userId)
      .where(sql`${t.collectionId} IS NOT NULL AND ${t.status} = 'pending'`),
    check('payments_amount_positive', sql`${t.amount} > 0`),
    // в одну сторону: ON DELETE SET NULL по booking_id оставляет воплощение как историю
    check(
      'payments_booking_incarnation_required',
      sql`${t.bookingId} IS NULL OR ${t.bookingIncarnation} IS NOT NULL`,
    ),
    check(
      'payments_seat_released_status',
      sql`${t.seatReleasedAt} IS NULL OR ${t.status} IN ('succeeded', 'refunded')`,
    ),
  ],
)

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
