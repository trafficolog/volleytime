import { bookings, eq, inArray, sql, type DbOrTx } from '@volley-time/db'

/**
 * Статусы, места которых заняты в составе события (ADR v3, «Места в записи»): занято мест =
 * SUM(seats) по ним, «игроков» = COUNT(*) тех же строк — разные величины.
 */
export const OCCUPYING_STATUSES = ['confirmed', 'pending_payment', 'attended', 'no_show'] as const

/** SQL: занятые места (для `.select`). */
export const takenSeatsSql = sql<number>`coalesce(sum(${bookings.seats}) FILTER (WHERE ${inArray(bookings.status, [...OCCUPYING_STATUSES])}), 0)::int`

/** SQL: места в очереди — вся запись `waitlisted` или очередная часть записи в основе. */
export const queuedSeatsSql = sql<number>`coalesce(sum(CASE WHEN ${bookings.status} = 'waitlisted' THEN ${bookings.seats} ELSE ${bookings.waitlistSeats} END) FILTER (WHERE ${bookings.status} IN ('waitlisted', 'confirmed', 'pending_payment')), 0)::int`

/** Запись стоит в очереди (целиком или частью мест); порядок очереди — (booked_at, id). */
export const inQueueSql = sql`(${bookings.status} = 'waitlisted' OR ${bookings.waitlistSeats} > 0)`

/** Занятые места события. Вызывающий держит advisory-lock события, если решает по результату. */
export async function takenSeats(db: DbOrTx, eventId: number): Promise<number> {
  const [row] = await db
    .select({ taken: takenSeatsSql })
    .from(bookings)
    .where(eq(bookings.eventId, eventId))
  return row?.taken ?? 0
}
