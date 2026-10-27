/**
 * Статус оплаты мест записи для самого игрока (21.1.8, D-14). Платёж по месту живой, пока место не
 * освобождено: `pending` — ждёт оплаты, `succeeded` — оплачено; `succeeded` с `seat_released_at` —
 * «оплачено, место освобождено» (без автоматического возврата, возврат — действие организатора).
 */
export interface SeatPaymentsView {
  /** Оплаченные места (живые платежи `succeeded`). */
  paidSeats: number
  /** Места, ожидающие оплаты (живые платежи `pending`). */
  pendingSeats: number
  /** Оплаченные места, освобождённые игроком без возврата (`succeeded` + `seat_released_at`). */
  releasedPaidSeats: number
}

export const EMPTY_SEAT_PAYMENTS: SeatPaymentsView = Object.freeze({
  paidSeats: 0,
  pendingSeats: 0,
  releasedPaidSeats: 0,
})

/** Проекция платежей текущего воплощения записи в счётчики мест. Отменённые и возвращённые не считаются. */
export function seatPaymentsFromRows(
  rows: readonly { status: string; seatReleasedAt: Date | string | null }[],
): SeatPaymentsView {
  let paidSeats = 0
  let pendingSeats = 0
  let releasedPaidSeats = 0
  for (const row of rows) {
    if (row.status === 'succeeded') {
      if (row.seatReleasedAt === null) paidSeats += 1
      else releasedPaidSeats += 1
    } else if (row.status === 'pending' && row.seatReleasedAt === null) {
      pendingSeats += 1
    }
  }
  return { paidSeats, pendingSeats, releasedPaidSeats }
}

/**
 * Сколько оплаченных мест освободится при снятии `removed` мест записи. Повторяет порядок ядра
 * (`bookingService.changeSeats`): сначала очередь, затем неоплаченные места, затем занятия абонемента
 * (возвращаются), и только потом оплаченные. Полная отмена снимает все места: освобождаются все оплаченные.
 */
export function paidSeatsReleasedByRemoving(
  removed: number,
  booking: { status: string; method: string; seats: number; waitlistSeats: number },
  payments: SeatPaymentsView,
): number {
  if (booking.status === 'waitlisted') return 0
  const fromMain = Math.max(0, removed - booking.waitlistSeats)
  const unpaid = Math.min(fromMain, payments.pendingSeats)
  const subscriptionSeats =
    booking.method === 'subscription'
      ? Math.max(0, booking.seats - payments.paidSeats - payments.pendingSeats)
      : 0
  const restored = Math.min(fromMain - unpaid, subscriptionSeats)
  return Math.min(payments.paidSeats, Math.max(0, fromMain - unpaid - restored))
}
