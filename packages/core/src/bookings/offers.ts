import {
  and,
  asc,
  bookings,
  db as defaultDb,
  eq,
  events,
  lte,
  sql,
  waitlistOffers,
  type DbOrTx,
  type Event,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { enqueueNotification } from '../scheduler/journal'
import { getDb, systemContext, type ServiceContext } from '../shared/context'

import { inQueueSql, takenSeats } from './seats'

/** Срок предложения места из очереди (D-03). */
export const OFFER_TTL_MS = 30 * 60_000

/** Места под активными предложениями события — заняты при подсчёте свободных (ADR v3). */
export async function offeredSeats(db: DbOrTx, eventId: number): Promise<number> {
  const [row] = await db
    .select({ seats: sql<number>`coalesce(sum(${waitlistOffers.seats}), 0)::int` })
    .from(waitlistOffers)
    .where(and(eq(waitlistOffers.eventId, eventId), eq(waitlistOffers.status, 'offered')))
  return row?.seats ?? 0
}

/**
 * Недоступные для новой записи места: занятые записями и удерживаемые предложениями.
 * Вызывающий держит advisory-lock события, если решает по результату.
 */
export async function reservedSeats(db: DbOrTx, eventId: number): Promise<number> {
  return (await takenSeats(db, eventId)) + (await offeredSeats(db, eventId))
}

/** Снять активное предложение записи (отмена записи или изменение её мест). Под lock события. */
export async function revokeBookingOffers(
  db: DbOrTx,
  bookingId: number,
  now = new Date(),
): Promise<number> {
  const rows = await db
    .update(waitlistOffers)
    .set({ status: 'revoked', respondedAt: now })
    .where(and(eq(waitlistOffers.bookingId, bookingId), eq(waitlistOffers.status, 'offered')))
    .returning({ id: waitlistOffers.id })
  return rows.length
}

/** Снять все активные предложения события (отмена события, закрытие записи). Под lock события. */
export async function revokeEventOffers(
  db: DbOrTx,
  eventId: number,
  now = new Date(),
): Promise<number> {
  const rows = await db
    .update(waitlistOffers)
    .set({ status: 'revoked', respondedAt: now })
    .where(and(eq(waitlistOffers.eventId, eventId), eq(waitlistOffers.status, 'offered')))
    .returning({ id: waitlistOffers.id })
  return rows.length
}

const offerParams = (event: Event, seats: number) => ({
  eventTitle: event.title,
  eventDate: event.startsAt.toISOString(),
  organizationId: event.organizationId,
  eventId: event.id,
  seats,
})

/**
 * Предложить свободные места очереди (D-03, планировщик включён): первому в очереди
 * (`(booked_at, id)`) без активного предложения — столько мест, сколько свободно, но не больше его
 * мест в очереди; затем следующему, пока есть свободные места. Предложение держит места 30 мин;
 * уведомление ставится в журнал в той же транзакции (outbox). Вызывающий держит
 * `pg_advisory_xact_lock(event.id)`. Возвращает число созданных предложений.
 */
export async function offerFreeSeats(
  ctx: ServiceContext,
  event: Event,
  now = new Date(),
): Promise<number> {
  const db = getDb(ctx)
  if (event.status !== 'published' || event.pricingSettledAt || event.startsAt <= now) return 0
  let free = event.capacity - (await reservedSeats(db, event.id))
  let created = 0
  while (free > 0) {
    const [next] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.eventId, event.id),
          inQueueSql,
          sql`NOT EXISTS (SELECT 1 FROM ${waitlistOffers} o
            WHERE o.booking_id = ${bookings.id} AND o.status = 'offered')`,
        ),
      )
      .orderBy(asc(bookings.bookedAt), asc(bookings.id))
      .limit(1)
      .for('update')
    if (!next) break
    const queued = next.status === 'waitlisted' ? next.seats : next.waitlistSeats
    const seats = Math.min(free, queued)
    const [offer] = await db
      .insert(waitlistOffers)
      .values({
        organizationId: event.organizationId,
        eventId: event.id,
        bookingId: next.id,
        seats,
        offeredAt: now,
        expiresAt: new Date(now.getTime() + OFFER_TTL_MS),
      })
      .returning()
    await auditService.record(ctx, {
      organizationId: event.organizationId,
      action: AUDIT_ACTIONS.WAITLIST_OFFER_CREATED,
      entityType: 'waitlist_offer',
      entityId: offer!.id,
      newValue: { bookingId: next.id, seats, expiresAt: offer!.expiresAt },
    })
    await enqueueNotification(db, {
      type: 'waitlist_offer',
      dedupKey: `waitlist_offer:offer:${offer!.id}`,
      organizationId: event.organizationId,
      eventId: event.id,
      userId: next.userId,
      params: offerParams(event, seats),
      check: { kind: 'offer', offerId: offer!.id },
      runAt: now,
    })
    free -= seats
    created++
  }
  return created
}

/**
 * Истечение предложений (задача планировщика): `offered` с наступившим `expires_at` → `expired`,
 * запись не ответившего игрока покидает очередь (вся запись `waitlisted` отменяется, у записи в
 * основе снимаются места в очереди), освобождённые места предлагаются следующему. Под lock события;
 * переход только из `offered`, поэтому повтор и параллельные экземпляры безопасны.
 */
export async function expireDueOffers(now: Date, limit = 50): Promise<number> {
  const due = await defaultDb
    .selectDistinct({ eventId: waitlistOffers.eventId })
    .from(waitlistOffers)
    .where(and(eq(waitlistOffers.status, 'offered'), lte(waitlistOffers.expiresAt, now)))
    .limit(limit)
  let expired = 0
  for (const { eventId } of due) {
    try {
      expired += await defaultDb.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)
        const ctx = systemContext(tx)
        const offers = await tx
          .select()
          .from(waitlistOffers)
          .where(
            and(
              eq(waitlistOffers.eventId, eventId),
              eq(waitlistOffers.status, 'offered'),
              lte(waitlistOffers.expiresAt, now),
            ),
          )
          .orderBy(asc(waitlistOffers.id))
          .for('update')
        const [event] = await tx.select().from(events).where(eq(events.id, eventId)).for('update')
        for (const offer of offers) {
          await tx
            .update(waitlistOffers)
            .set({ status: 'expired', respondedAt: now })
            .where(and(eq(waitlistOffers.id, offer.id), eq(waitlistOffers.status, 'offered')))
          const [booking] = await tx
            .select()
            .from(bookings)
            .where(eq(bookings.id, offer.bookingId))
            .for('update')
          if (booking?.status === 'waitlisted') {
            await tx
              .update(bookings)
              .set({ status: 'cancelled', waitlistSeats: 0, cancelledAt: now, updatedAt: now })
              .where(eq(bookings.id, booking.id))
          } else if (booking && booking.waitlistSeats > 0) {
            await tx
              .update(bookings)
              .set({ waitlistSeats: 0, updatedAt: now })
              .where(eq(bookings.id, booking.id))
          }
          await auditService.record(ctx, {
            organizationId: offer.organizationId,
            action: AUDIT_ACTIONS.WAITLIST_OFFER_EXPIRED,
            entityType: 'waitlist_offer',
            entityId: offer.id,
            oldValue: booking
              ? {
                  status: booking.status,
                  seats: booking.seats,
                  waitlistSeats: booking.waitlistSeats,
                }
              : null,
            newValue: { bookingId: offer.bookingId, leftQueue: true },
          })
          if (booking && event)
            await enqueueNotification(tx, {
              type: 'waitlist_offer_expired',
              dedupKey: `waitlist_offer_expired:offer:${offer.id}`,
              organizationId: offer.organizationId,
              eventId,
              userId: booking.userId,
              params: offerParams(event, offer.seats),
              runAt: now,
            })
        }
        if (event) await offerFreeSeats(ctx, event, now)
        return offers.length
      })
    } catch (e) {
      console.error('[scheduler] offer expiry failed', { eventId, error: e })
    }
  }
  return expired
}
