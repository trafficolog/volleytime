import {
  and,
  bookings,
  eq,
  events,
  inArray,
  organizationMembers,
  organizations,
  payments,
  sql,
} from '@volley-time/db'
import {
  previewSplitAmount,
  quoteEventPrice,
  type EventPriceQuote,
  type EventPricingView,
  type PricingFinancials,
  type PricingPermissions,
} from '@volley-time/shared'

import { SeatsOverLimitError } from '../bookings/errors'
import { OCCUPYING_STATUSES as ACTIVE_STATUSES, takenSeatsSql } from '../bookings/seats'
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
    .select({ taken: takenSeatsSql })
    .from(bookings)
    .where(eq(bookings.eventId, eventId))
  // статус оплаты моей записи — по живым платежам мест (20.1.2): есть неоплаченное место — pending
  const [mine] = await db
    .select({
      allocatedAmount: bookings.allocatedAmount,
      // имена квалифицированы явно: drizzle не пишет таблицу у колонок запроса без JOIN,
      // а в коррелированном подзапросе "id" разрешился бы в payments.id
      paymentStatus: sql<'pending' | 'succeeded' | null>`(
        SELECT CASE WHEN bool_or(p.status = 'pending') THEN 'pending' ELSE 'succeeded' END
        FROM "payments" p
        WHERE p.booking_id = "bookings"."id"
          AND p.booking_incarnation = "bookings"."incarnation"
          AND p.seat_released_at IS NULL
          AND p.status IN ('pending', 'succeeded')
        HAVING count(*) > 0)`,
    })
    .from(bookings)
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

export interface EventPriceQuoteView extends EventPriceQuote {
  currency: string
}

/**
 * Цена места для `seats` мест игрока (20.1.1, P-03): единый расчёт `quoteEventPrice` для Mini App,
 * кабинета и публичной страницы. Чтение без блокировок: до закрытия split — прогноз по текущему
 * составу (занято мест — SUM(seats), 20.1.2), после фиксации — снимок `pricing_participant_count`
 * (места) и доля игрока, которые не меняются. Мои места — `bookings.seats` моей записи в составе.
 */
export async function readEventPriceQuote(
  ctx: ServiceContext,
  input: { organizationId: number; eventId: number; seats?: number; includeDrafts: boolean },
): Promise<EventPriceQuoteView> {
  const db = getDb(ctx)
  const event = await db.query.events.findFirst({
    where: and(eq(events.id, input.eventId), eq(events.organizationId, input.organizationId)),
  })
  if (!event || (event.status === 'draft' && !input.includeDrafts))
    throw new EventNotFoundError(input.eventId)
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, input.organizationId),
    columns: { subscriptionsEnabled: true, maxSeatsPerBooking: true },
  })
  if (!org) throw new EventNotFoundError(input.eventId)
  const [counts] = await db
    .select({ taken: takenSeatsSql })
    .from(bookings)
    .where(eq(bookings.eventId, event.id))
  const mine = await db.query.bookings.findFirst({
    where: and(
      eq(bookings.eventId, event.id),
      eq(bookings.userId, ctx.userId),
      inArray(bookings.status, [...ACTIVE_STATUSES]),
    ),
    columns: { allocatedAmount: true, seats: true },
  })
  const mySeats = mine?.seats ?? 0
  const seats = input.seats ?? (mySeats || 1)
  if (seats > org.maxSeatsPerBooking || seats > event.capacity) throw new SeatsOverLimitError()
  const quote =
    event.priceMode === 'fixed'
      ? quoteEventPrice({
          mode: 'fixed',
          price: event.price,
          seats,
          subscriptionsEnabled: org.subscriptionsEnabled,
        })
      : quoteEventPrice({
          mode: 'split',
          targetAmount: event.targetAmount!,
          capacity: event.capacity,
          // после уменьшения вместимости состав не может превышать её в формуле прогноза
          takenSeats: Math.min(counts?.taken ?? 0, event.capacity),
          mySeats,
          seats,
          settled:
            event.pricingSettledAt !== null
              ? {
                  participantCount: event.pricingParticipantCount!,
                  myAllocatedAmount: mine?.allocatedAmount ?? null,
                }
              : null,
        })
  return { ...quote, currency: event.currency }
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
