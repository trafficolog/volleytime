/**
 * Кнопка «Оплатить» в «Моих записях» (21.4.8, M-13): только для записи, которая ждёт оплаты
 * наличными или переводом. Правило совпадает с показом «Как оплатить» на экране события
 * (21.2.11): у split до распределения суммы платить ещё нечего, абонемент и онлайн — не вручную.
 * Только показ реквизитов: запись и платёж не меняются.
 */
export interface PayableBooking {
  status: string
  method: string | null
  event: { status: string }
  pricing?: { mode: string; myAllocatedAmount?: number | null }
}

export function canPayBooking(b: PayableBooking): boolean {
  return (
    b.status === 'pending_payment' &&
    (b.method === 'cash' || b.method === 'transfer') &&
    b.event.status !== 'cancelled' &&
    !(b.pricing?.mode === 'split' && (b.pricing.myAllocatedAmount ?? null) === null)
  )
}

export function payBookingPath(orgId: number, bookingId: number): string {
  return `/m/orgs/${orgId}/pay/${bookingId}`
}
