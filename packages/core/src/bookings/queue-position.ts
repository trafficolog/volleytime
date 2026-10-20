import {
  and,
  bookings,
  eq,
  events,
  inArray,
  sql,
  waitlistOffers,
  type DbOrTx,
} from '@volley-time/db'

import { isBookingClosedBySchedule } from '../events/booking-close'

import { inQueueSql } from './seats'

/**
 * Позиция игрока в очереди события (20.4.11). Правило одно с планировщиком: в очереди — записи
 * `waitlisted` и записи в основе с `waitlist_seats > 0` (`inQueueSql`), порядок `(booked_at, id)`
 * (`offerFreeSeats`, `promoteFromWaitlist`). Позиция — номер ЗАПИСИ, а не места: запись на
 * несколько мест занимает одну позицию. Запись с истёкшим, но ещё не обработанным предложением
 * позиции не имеет и впереди других не считается: её владелец покидает очередь (решение владельца
 * 2026-10-16, D-03).
 *
 * Позиции нет у событий, где очередь уже не движется: не опубликовано, началось, закрыто по
 * расписанию, рассчитано (решение владельца 2026-10-20) — там игрок «не попал».
 *
 * Возвращает `bookingId → позиция` только для записей `userId` в очереди; чужие записи наружу не
 * отдаются — считается лишь их число.
 */
export async function queuePositionsOf(
  db: DbOrTx,
  userId: number,
  eventIds: readonly number[],
  now = new Date(),
): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  if (eventIds.length === 0) return out
  const mine = await db
    .select({ id: bookings.id, eventId: bookings.eventId })
    .from(bookings)
    .where(and(eq(bookings.userId, userId), inArray(bookings.eventId, [...eventIds]), inQueueSql))
  if (mine.length === 0) return out
  const candidates = await db
    .select()
    .from(events)
    .where(inArray(events.id, [...new Set(mine.map((m) => m.eventId))]))
  const openIds = new Set<number>()
  for (const e of candidates) {
    if (e.status !== 'published' || e.pricingSettledAt || e.startsAt <= now) continue
    if (await isBookingClosedBySchedule(db, e, now)) continue
    openIds.add(e.id)
  }
  const ids = mine.filter((m) => openIds.has(m.eventId)).map((m) => m.id)
  if (ids.length === 0) return out
  const at = now.toISOString()
  const rows = await db.execute(sql`
    SELECT b.id, (
      SELECT count(*)::int FROM ${bookings} a
      WHERE a.event_id = b.event_id
        AND (a.status = 'waitlisted' OR a.waitlist_seats > 0)
        AND (a.booked_at, a.id) <= (b.booked_at, b.id)
        AND NOT EXISTS (SELECT 1 FROM ${waitlistOffers} o
          WHERE o.booking_id = a.id AND o.status = 'offered' AND o.expires_at <= ${at}::timestamptz)
    ) AS pos
    FROM ${bookings} b
    WHERE b.id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})
      AND NOT EXISTS (SELECT 1 FROM ${waitlistOffers} o
        WHERE o.booking_id = b.id AND o.status = 'offered' AND o.expires_at <= ${at}::timestamptz)`)
  for (const row of rows) out.set(Number(row.id), Number(row.pos))
  return out
}
