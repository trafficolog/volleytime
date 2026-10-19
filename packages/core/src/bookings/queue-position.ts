import { bookings, sql, waitlistOffers, type DbOrTx } from '@volley-time/db'

/**
 * Позиция игрока в очереди события (20.4.11). Правило одно с планировщиком: в очереди — записи
 * `waitlisted` и записи в основе с `waitlist_seats > 0` (`inQueueSql`), порядок `(booked_at, id)`
 * (`offerFreeSeats`, `promoteFromWaitlist`). Позиция — номер ЗАПИСИ, а не места: запись на
 * несколько мест занимает одну позицию. Запись с истёкшим, но ещё не обработанным предложением
 * впереди не считается: её владелец покидает очередь (решение владельца 2026-10-16, D-03).
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
  const at = now.toISOString()
  const events = sql.join(
    eventIds.map((id) => sql`${id}`),
    sql`, `,
  )
  const rows = await db.execute(sql`
    SELECT b.id, (
      SELECT count(*)::int FROM ${bookings} a
      WHERE a.event_id = b.event_id
        AND (a.status = 'waitlisted' OR a.waitlist_seats > 0)
        AND (a.booked_at, a.id) <= (b.booked_at, b.id)
        AND (a.id = b.id OR NOT EXISTS (SELECT 1 FROM ${waitlistOffers} o
          WHERE o.booking_id = a.id AND o.status = 'offered' AND o.expires_at <= ${at}::timestamptz))
    ) AS pos
    FROM ${bookings} b
    WHERE b.user_id = ${userId} AND b.event_id IN (${events})
      AND (b.status = 'waitlisted' OR b.waitlist_seats > 0)`)
  for (const row of rows) out.set(Number(row.id), Number(row.pos))
  return out
}
