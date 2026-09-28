import {
  and,
  bookings,
  desc,
  eq,
  events,
  payments,
  sql,
  subscriptionPlans,
  subscriptions,
  users,
  type Payment,
  type User,
} from '@volley-time/db'

import { getDb, type ServiceContext } from '../shared/context'

export interface PaymentHistoryCursor {
  createdAt: string
  id: number
}

export interface PaymentHistoryRow {
  id: number
  status: Payment['status']
  amount: number
  currency: string
  method: Payment['method']
  createdAt: string
  confirmedAt: Date | null
  refundedAt: Date | null
  user: Pick<User, 'id' | 'name' | 'telegramUsername' | 'image'>
  event: { id: number; title: string; startsAt: Date } | null
  plan: { name: string } | null
}

export async function listPaymentHistory(
  ctx: ServiceContext,
  orgId: number,
  opts: { status?: Payment['status']; limit: number; cursor?: PaymentHistoryCursor },
): Promise<{ payments: PaymentHistoryRow[]; nextCursor: PaymentHistoryCursor | null }> {
  const conditions = [eq(payments.organizationId, orgId)]
  if (opts.status) conditions.push(eq(payments.status, opts.status))
  if (opts.cursor) {
    conditions.push(
      sql`(${payments.createdAt}, ${payments.id}) < (${opts.cursor.createdAt}::timestamptz, ${opts.cursor.id})`,
    )
  }
  const rows = await getDb(ctx)
    .select({
      id: payments.id,
      status: payments.status,
      amount: payments.amount,
      currency: payments.currency,
      method: payments.method,
      createdAt: sql<string>`to_char(${payments.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      confirmedAt: payments.confirmedAt,
      refundedAt: payments.refundedAt,
      user: {
        id: users.id,
        name: users.name,
        telegramUsername: users.telegramUsername,
        image: users.image,
      },
      event: { id: events.id, title: events.title, startsAt: events.startsAt },
      plan: { name: subscriptionPlans.name },
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.userId))
    .leftJoin(
      bookings,
      and(eq(bookings.id, payments.bookingId), eq(bookings.organizationId, orgId)),
    )
    .leftJoin(events, and(eq(events.id, bookings.eventId), eq(events.organizationId, orgId)))
    .leftJoin(
      subscriptions,
      and(eq(subscriptions.id, payments.subscriptionId), eq(subscriptions.organizationId, orgId)),
    )
    .leftJoin(
      subscriptionPlans,
      and(
        eq(subscriptionPlans.id, subscriptions.planId),
        eq(subscriptionPlans.organizationId, orgId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(payments.createdAt), desc(payments.id))
    .limit(opts.limit + 1)
  const page = rows.slice(0, opts.limit)
  const last = page.at(-1)
  return {
    payments: page,
    nextCursor:
      rows.length > opts.limit && last ? { createdAt: last.createdAt, id: last.id } : null,
  }
}
