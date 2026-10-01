import { and, bookings, eq, events, organizationMembers, sql, type Event } from '@volley-time/db'
import { allocateSplitAmount } from '@volley-time/shared'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
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
      if (event.targetAmount! < participants.length)
        throw new EventError(
          'event.split_target_too_small',
          'The target must cover at least one cent per participant',
        )
      const allocation = allocateSplitAmount(
        event.targetAmount!,
        participants.map((b) => ({ bookingId: b.id, bookedAt: b.bookedAt })),
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
            status: 'pending_payment',
            confirmedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, booking.id))
      }
      const [settled] = await db
        .update(events)
        .set({
          status: 'closed',
          pricingSettledAt: new Date(),
          pricingParticipantCount: participants.length,
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
      return result
    })
  },
}
