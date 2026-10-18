import {
  and,
  bookings,
  eq,
  events,
  inArray,
  organizationMembers,
  sql,
  type Event,
} from '@volley-time/db'
import { allocateSplitAmount } from '@volley-time/shared'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { revokeEventOffers } from '../bookings/offers'
import { collectNotification } from '../notifier/collect'
import { paymentService } from '../payments/service'
import { requireCanManageContent } from '../permissions/policies'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import { EventError, EventNotFoundError } from './errors'

export interface SplitSettlementResult {
  event: Event
  summary: { targetAmount: number; participantCount: number; minAmount: number; maxAmount: number }
}

function snapshot(event: Event): SplitSettlementResult {
  const targetAmount = event.targetAmount!
  const participantCount = event.pricingParticipantCount!
  const minAmount = Math.floor(targetAmount / participantCount)
  return {
    event,
    summary: {
      targetAmount,
      participantCount,
      minAmount,
      maxAmount: minAmount + (targetAmount % participantCount === 0 ? 0 : 1),
    },
  }
}

export const eventPricingService = {
  async settle(
    ctx: ServiceContext,
    orgId: number,
    eventId: number,
  ): Promise<SplitSettlementResult> {
    return inTransaction(ctx, async (txCtx) => {
      const db = getDb(txCtx)
      await db.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)
      const [event] = await db
        .select()
        .from(events)
        .where(and(eq(events.id, eventId), eq(events.organizationId, orgId)))
        .for('update')
      if (!event) throw new EventNotFoundError(eventId)
      const member = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, ctx.userId),
        ),
      })
      requireCanManageContent(member ?? null)
      return settleLockedEvent(txCtx, event)
    })
  },
}

/**
 * Зафиксировать доли split по местам и закрыть запись (D-01, 20.1.2). Общий путь ручной фиксации
 * организатором и автоматической — планировщиком при закрытии записи (20.3.1). Вызывающий держит
 * `pg_advisory_xact_lock(event.id)` и строку события FOR UPDATE; повтор после фиксации возвращает
 * прежний результат без новых платежей.
 */
export async function settleLockedEvent(
  txCtx: ServiceContext,
  event: Event,
): Promise<SplitSettlementResult> {
  const db = getDb(txCtx)
  const eventId = event.id
  const orgId = event.organizationId
  if (event.priceMode !== 'split')
    throw new EventError('event.not_split', 'Only split events can be settled')
  if (event.pricingSettledAt !== null) return snapshot(event)
  if (event.status !== 'published')
    throw new EventError('event.not_settleable', 'Only published events can be settled')
  const participants = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.eventId, eventId),
        sql`${bookings.status} IN ('confirmed', 'pending_payment')`,
      ),
    )
    .for('update')
  if (participants.length === 0)
    throw new EventError('event.split_empty', 'Add participants before settling')
  // доли — по единицам-местам (20.1.2, ADR): цель сравнивается с суммой мест, не с числом записей
  const seatCount = participants.reduce((total, b) => total + b.seats, 0)
  // состав больше вместимости (уменьшенная вместимость, данные вне сервиса): прогноз делит на
  // вместимость, фиксация — на фактические места; расхождение не допускаем (follow-up 20.5.6)
  if (seatCount > event.capacity)
    throw new EventError(
      'event.split_over_capacity',
      'Occupied seats exceed capacity; fix the roster or capacity before settling',
    )
  if (event.targetAmount! < seatCount)
    throw new EventError(
      'event.split_target_too_small',
      'The target must cover at least one cent per participant',
    )
  const allocation = allocateSplitAmount(
    event.targetAmount!,
    participants.map((b) => ({ bookingId: b.id, bookedAt: b.bookedAt, seats: b.seats })),
  )
  const byId = new Map(participants.map((b) => [b.id, b]))
  for (const share of allocation) {
    const booking = byId.get(share.bookingId)!
    if (
      (booking.method !== 'cash' && booking.method !== 'transfer') ||
      booking.paymentId !== null ||
      booking.allocatedAmount !== null
    ) {
      throw new EventError(
        'event.split_booking_invalid',
        'Split reservation has incompatible payment state',
      )
    }
    const payment = await paymentService.createForBooking(
      txCtx,
      {
        organizationId: orgId,
        userId: booking.userId,
        bookingId: booking.id,
        amount: share.amount,
        currency: event.currency,
        method: booking.method,
      },
      { notifyOrganizers: false },
    )
    await db
      .update(bookings)
      .set({
        paymentId: payment.id,
        allocatedAmount: share.amount,
        // очередная часть мест после фиксации не продвигается — снимается (ревью 20.1.2)
        waitlistSeats: 0,
        status: 'pending_payment',
        confirmedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id))
  }
  // запись закрывается: активные предложения мест из очереди снимаются (20.3.1)
  await revokeEventOffers(db, eventId)
  const [settled] = await db
    .update(events)
    .set({
      status: 'closed',
      pricingSettledAt: new Date(),
      // имя колонки R0.7; после 20.1.2 — число мест на момент фиксации
      pricingParticipantCount: seatCount,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId))
    .returning()
  const result = snapshot(settled!)
  await auditService.record(txCtx, {
    organizationId: orgId,
    action: AUDIT_ACTIONS.EVENT_PRICING_SETTLED,
    entityType: 'event',
    entityId: eventId,
    newValue: result.summary,
  })
  const managers = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.status, 'active'),
        inArray(organizationMembers.role, ['owner', 'organizer']),
      ),
    )
  const params = {
    eventTitle: event.title,
    eventDate: event.startsAt.toISOString(),
    organizationId: orgId,
    eventId,
    currency: event.currency,
    target: 'event' as const,
  }
  for (const share of allocation) {
    const booking = byId.get(share.bookingId)!
    collectNotification(txCtx, {
      userId: booking.userId,
      type: 'split_price_settled',
      params: { ...params, amount: share.amount, method: booking.method },
    })
  }
  for (const manager of managers)
    collectNotification(txCtx, {
      userId: manager.userId,
      type: 'split_settled_organizer',
      params: {
        ...params,
        targetAmount: result.summary.targetAmount,
        participantCount: result.summary.participantCount,
      },
    })
  return result
}
