import { seatsLabel } from './booking-seats'

/**
 * D-14: оплаченные места освобождаются без автоматического возврата. Текст совпадает с подтверждением
 * отмены в боте (apps/bot callbacks `CANCEL_QUESTION`) и со снятием записи у организатора (`removeBookingText`).
 */
export const CANCEL_REFUND_NOTE =
  'Оплаченные места освободятся без возврата денег: возврат — отдельное действие организатора.'

/** Оплата наличными или переводом: отмена может освободить оплаченные места (D-14). Только представление. */
export function cancelMayReleasePaidSeats(method: string | null | undefined): boolean {
  return method === 'cash' || method === 'transfer'
}

/** Подтверждение полной отмены: вопрос и, для оплаты деньгами, пояснение D-14. */
export function cancelConfirmText(question: string, method: string | null | undefined): string {
  return cancelMayReleasePaidSeats(method) ? `${question} ${CANCEL_REFUND_NOTE}` : question
}

/** Подтверждение частичной отмены: сколько снимается, сколько остаётся, пояснение D-14. */
export function seatsCancelConfirmText(
  removed: number,
  kept: number,
  method: string | null | undefined,
): string {
  const question = `Снять ${seatsLabel(removed)}? Останется ${seatsLabel(kept)}.`
  return cancelMayReleasePaidSeats(method) ? `${question} ${CANCEL_REFUND_NOTE}` : question
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
