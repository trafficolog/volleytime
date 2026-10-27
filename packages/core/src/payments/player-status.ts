import { and, bookings, eq, inArray, payments } from '@volley-time/db'
import { seatPaymentsFromRows, type SeatPaymentsView } from '@volley-time/shared'

import { getDb, type ServiceContext } from '../shared/context'

/**
 * Статус оплаты мест СВОИХ записей игрока (21.1.8, D-14): оплачено / ждёт оплаты / «оплачено, место
 * освобождено». Только платежи текущего воплощения записей, которые принадлежат `ctx.userId` в группе
 * `orgId`: чужие записи и платежи в ответ не попадают (запись чужого игрока или другой группы даёт
 * пустой результат). Суммы, способ и заметки платежа не отдаются — только счётчики мест.
 */
export async function readMySeatPayments(
  ctx: ServiceContext,
  orgId: number,
  bookingIds: readonly number[],
): Promise<Map<number, SeatPaymentsView>> {
  const out = new Map<number, SeatPaymentsView>()
  if (bookingIds.length === 0) return out
  const rows = await getDb(ctx)
    .select({
      bookingId: payments.bookingId,
      status: payments.status,
      seatReleasedAt: payments.seatReleasedAt,
    })
    .from(payments)
    .innerJoin(
      bookings,
      and(
        eq(bookings.id, payments.bookingId),
        eq(payments.bookingIncarnation, bookings.incarnation),
      ),
    )
    .where(
      and(
        inArray(payments.bookingId, [...bookingIds]),
        eq(bookings.userId, ctx.userId),
        eq(bookings.organizationId, orgId),
        eq(payments.organizationId, orgId),
        eq(payments.userId, ctx.userId),
      ),
    )
  const byBooking = new Map<number, { status: string; seatReleasedAt: Date | null }[]>()
  for (const row of rows) {
    const list = byBooking.get(row.bookingId!) ?? []
    list.push(row)
    byBooking.set(row.bookingId!, list)
  }
  for (const id of bookingIds) out.set(id, seatPaymentsFromRows(byBooking.get(id) ?? []))
  return out
}
