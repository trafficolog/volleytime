import { and, bookings, eq, events, organizationMembers, payments, sql } from '@volley-time/db'
import {
  previewSplitAmount,
  type EventPricingView,
  type PricingFinancials,
  type PricingPermissions,
} from '@volley-time/shared'

import { requireCanManageContent } from '../permissions/policies'
import { getDb, type ServiceContext } from '../shared/context'

import { EventNotFoundError } from './errors'

export async function readEventPricing(
  ctx: ServiceContext,
  eventId: number,
): Promise<EventPricingView> {
  const db = getDb(ctx)
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
  if (!event) throw new EventNotFoundError(eventId)
  const [counts] = await db
    .select({
      taken: sql<number>`count(*) FILTER (WHERE ${bookings.status} IN ('confirmed', 'pending_payment', 'attended', 'no_show'))::int`,
    })
    .from(bookings)
    .where(eq(bookings.eventId, eventId))
  const [mine] = await db
    .select({ allocatedAmount: bookings.allocatedAmount, paymentStatus: payments.status })
    .from(bookings)
    .leftJoin(
      payments,
      and(eq(payments.id, bookings.paymentId), eq(payments.bookingId, bookings.id)),
    )
    .where(and(eq(bookings.eventId, eventId), eq(bookings.userId, ctx.userId)))
  const common = {
    mode: event.priceMode,
    targetAmount: event.targetAmount,
    settledAt: event.pricingSettledAt?.toISOString() ?? null,
    myAllocatedAmount: mine?.allocatedAmount ?? null,
    myPaymentStatus: mine?.paymentStatus ?? null,
  }
  if (event.priceMode === 'fixed')
    return {
      ...common,
      participantCount: counts?.taken ?? 0,
      minAmount: event.price,
      maxAmount: event.price,
      basis: 'fixed',
    }
  if (event.pricingSettledAt !== null) {
    const participantCount = event.pricingParticipantCount!
    const minAmount = Math.floor(event.targetAmount! / participantCount)
    return {
      ...common,
      participantCount,
      minAmount,
      maxAmount: minAmount + (event.targetAmount! % participantCount === 0 ? 0 : 1),
      basis: 'settled',
    }
  }
  return {
    ...common,
    ...previewSplitAmount(event.targetAmount!, counts?.taken ?? 0, event.capacity),
  }
}

async function managerEvent(ctx: ServiceContext, eventId: number) {
  const db = getDb(ctx)
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
  if (!event || (ctx.organization && ctx.organization.id !== event.organizationId))
    throw new EventNotFoundError(eventId)
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, event.organizationId),
      eq(organizationMembers.userId, ctx.userId),
    ),
  })
  requireCanManageContent(member ?? null)
  return event
}

export async function readPricingPermissions(
  ctx: ServiceContext,
  eventId: number,
): Promise<PricingPermissions> {
  const event = await managerEvent(ctx, eventId)
  const history = await getDb(ctx).query.bookings.findFirst({
    where: eq(bookings.eventId, eventId),
    columns: { id: true },
  })
  const editable = event.status !== 'cancelled' && event.status !== 'finished'
  const unsettled = event.pricingSettledAt === null
  return {
    canChangePriceMode: editable && unsettled && !history,
    canChangeTargetAmount: editable && unsettled && event.priceMode === 'split',
    canSettle: event.status === 'published' && event.priceMode === 'split' && unsettled,
  }
}

export async function readPricingFinancials(
  ctx: ServiceContext,
  eventId: number,
): Promise<PricingFinancials> {
  const event = await managerEvent(ctx, eventId)
  const rows = await getDb(ctx)
    .select({ status: payments.status, amount: payments.amount })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(
      and(
        eq(bookings.eventId, eventId),
        eq(payments.organizationId, event.organizationId),
        eq(payments.currency, event.currency),
      ),
    )
  const result: PricingFinancials = {
    collected: 0,
    pending: 0,
    cancelled: 0,
    refunded: 0,
    currency: event.currency,
  }
  for (const row of rows)
    result[row.status === 'succeeded' ? 'collected' : row.status] += row.amount
  return result
}
