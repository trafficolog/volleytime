import { seatsLabel } from './booking-seats'
import { formatMoneyRu } from './labels'

/**
 * Кнопка «Оплатить» в «Моих записях» (21.4.8, 21.4.19, M-13): для записи, которая ждёт оплаты
 * наличными или переводом, и для проведённой записи (`attended`, `no_show`) с неоплаченным местом.
 * Правило совпадает с показом «Как оплатить» на экране события (21.2.11): у split до распределения
 * суммы платить ещё нечего, абонемент и онлайн — не вручную. Долг по проведённой записи берётся
 * из `seatPayments.pendingSeats` (сервер, только свои записи, 21.1.8): оплаченная проведённая запись
 * кнопку не показывает. Только показ реквизитов: запись и платёж не меняются.
 */
export interface PayableBooking {
  status: string
  method: string | null
  event: { status: string }
  pricing?: { mode: string; minAmount?: number; myAllocatedAmount?: number | null }
  seatPayments?: { pendingSeats: number }
}

/** Проведённая запись: посещение уже отмечено, платёж остаётся долгом, пока не подтверждён. */
export const HELD_STATUSES = ['attended', 'no_show']

export function canPayBooking(b: PayableBooking): boolean {
  const owes =
    b.status === 'pending_payment' ||
    (HELD_STATUSES.includes(b.status) && (b.seatPayments?.pendingSeats ?? 0) > 0)
  return (
    owes &&
    (b.method === 'cash' || b.method === 'transfer') &&
    b.event.status !== 'cancelled' &&
    !(b.pricing?.mode === 'split' && (b.pricing.myAllocatedAmount ?? null) === null)
  )
}

export function payBookingPath(orgId: number, bookingId: number): string {
  return `/m/orgs/${orgId}/pay/${bookingId}`
}

/**
 * Сколько должен игрок по проведённой записи (21.4.19): неоплаченные места × цена места, в копейках.
 * Цена места надёжна только у fixed; у split доля считается на запись, поэтому только число мест.
 * `null` — не проведённая запись или долга нет (сумму показывает экран по прежним правилам).
 */
export function heldDebtLabel(
  b: PayableBooking,
  currency: string,
): { text: string; amount: boolean } | null {
  const pending = b.seatPayments?.pendingSeats ?? 0
  if (!HELD_STATUSES.includes(b.status) || pending <= 0) return null
  if (b.pricing?.mode === 'fixed' && (b.pricing.minAmount ?? 0) > 0)
    return {
      text: `${formatMoneyRu(pending * b.pricing.minAmount!, currency)} · ${seatsLabel(pending)}`,
      amount: true,
    }
  return { text: `к оплате ${seatsLabel(pending)}`, amount: false }
}
