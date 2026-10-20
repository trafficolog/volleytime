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

/** Варианты «оставить N мест» при частичной отмене: от одного до общего числа минус один. */
export function partialCancelTargets(total: number): number[] {
  return Array.from({ length: Math.max(0, total - 1) }, (_, i) => i + 1)
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
