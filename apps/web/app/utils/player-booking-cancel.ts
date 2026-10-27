import { seatsLabel } from './booking-seats'

/**
 * D-14: оплаченные места освобождаются без автоматического возврата. Текст совпадает с подтверждением
 * отмены в боте (apps/bot callbacks `CANCEL_QUESTION`) и со снятием записи у организатора (`removeBookingText`).
 */
export const CANCEL_REFUND_NOTE =
  'Оплаченные места освободятся без возврата денег: возврат — отдельное действие организатора.'

/**
 * Подтверждение полной отмены: вопрос и, если среди освобождаемых мест есть реально оплаченные,
 * пояснение D-14. `paidSeats` — число оплаченных мест из API игрока (`seatPayments`, 21.1.8).
 */
export function cancelConfirmText(question: string, paidSeats: number): string {
  return paidSeats > 0 ? `${question} ${CANCEL_REFUND_NOTE}` : question
}

/**
 * Подтверждение частичной отмены: сколько снимается, сколько остаётся и, если среди снимаемых мест есть
 * оплаченные, пояснение D-14. `paidReleased` — сколько оплаченных мест освободится (`paidSeatsReleasedByRemoving`).
 */
export function seatsCancelConfirmText(
  removed: number,
  kept: number,
  paidReleased: number,
): string {
  const question = `Снять ${seatsLabel(removed)}? Останется ${seatsLabel(kept)}.`
  return paidReleased > 0 ? `${question} ${CANCEL_REFUND_NOTE}` : question
}

/** Строка истории: оплаченные места, освобождённые игроком без возврата (D-14, 21.1.8). */
export function releasedPaidSeatsLabel(releasedPaidSeats: number): string | null {
  if (releasedPaidSeats <= 0) return null
  return releasedPaidSeats === 1
    ? 'Оплачено, место освобождено'
    : `Оплачено, места освобождены: ${seatsLabel(releasedPaidSeats)}`
}

/** Подпись под кнопкой отмены записи на абонементе (M-09, решение владельца 2026-10-25). */
export const SUBSCRIPTION_RETURN_NOTE = 'Занятие вернётся на абонемент'

/**
 * Вернёт ли самоотмена занятие на абонемент. Повторяет правила ядра (`bookingService.cancel`):
 * занятия возвращаются только за места основы с занятиями абонемента — запись `confirmed` по абонементу
 * на событии с фиксированной ценой и без оплаты по месту (`paymentId`: места, продвинутые из очереди,
 * оплачены наличными). Запись в очереди (занятия не списаны) и split (абонементом не оплачивается) — нет.
 * Срок и политика отмены проверяет вызывающий: после срока кнопки отмены нет и подпись не нужна.
 */
export function sessionReturnsOnCancel(
  booking: { status: string; method: string; paymentId: number | null },
  pricingMode: string | null | undefined,
): boolean {
  return (
    booking.method === 'subscription' &&
    booking.status === 'confirmed' &&
    booking.paymentId == null &&
    pricingMode !== 'split'
  )
}
