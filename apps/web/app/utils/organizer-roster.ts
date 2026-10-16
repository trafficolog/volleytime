/**
 * Строка состава у организатора (20.5.6, W-05): общий словарь и модель отображения для кабинета и
 * Mini App организатора. Организаторский словарь («в составе», «ждёт оплаты», «в очереди») отдельно
 * от игрока («Иду», `participationOf`). Только представление: серверные статусы не меняются.
 * Места — не игроки: «+N» = `seats − 1` (20.1.2), занято мест = сумма `seats`.
 */

export interface RosterBooking {
  status: string
  method: string
  /** Места записи в её статусе. */
  seats: number
  /** Ещё места в очереди у записи в основе. */
  waitlistSeats: number
  paymentId: number | null
}

export type RosterTone = 'default' | 'grass' | 'amber' | 'rose'
export type RosterKind = 'confirmed' | 'pending' | 'attended' | 'no_show' | 'waitlist' | 'other'

export interface RosterChip {
  tone: RosterTone
  text: string
}

export const ORGANIZER_ROSTER_LABELS = {
  pending: 'ждёт оплаты',
  afterClose: 'сумма после закрытия',
  subscription: 'абон.',
  attended: 'был',
  noShow: 'не пришёл',
  waitlist: 'в очереди',
} as const

export interface RosterPricing {
  priceMode: 'fixed' | 'split'
  /** Цена места из `GET …/price` (`quoteEventPrice`): только для fixed. */
  perSeat?: number | null
}

export interface RosterRowView {
  kind: RosterKind
  chip: RosterChip | null
  /** Галочка «оплачено/в составе» вместо чипа. */
  paid: boolean
  /** «+N» рядом с именем: `seats − 1`. */
  extraSeats: number
  /** «3 места» — только при нескольких местах. */
  seatsText: string | null
  /** Сумма за все места записи (fixed при известной цене места). */
  totalAmount: number | null
  queuedSeats: number
  queuedText: string | null
  /** Платёж записи ждёт решения организатора (подтвердить/отклонить). */
  canResolvePayment: boolean
}

/** «1 место / 2 места / 5 мест / 21 место». */
export function seatsWordRu(count: number): string {
  const n = Math.abs(count)
  const word =
    n % 10 === 1 && n % 100 !== 11
      ? 'место'
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)
        ? 'места'
        : 'мест'
  return `${count} ${word}`
}

export function rosterRowOf(booking: RosterBooking, pricing: RosterPricing): RosterRowView {
  const seats = Math.max(0, booking.seats)
  const queuedSeats = Math.max(0, booking.waitlistSeats)
  const base = {
    extraSeats: Math.max(0, seats - 1),
    seatsText: seats > 1 ? seatsWordRu(seats) : null,
    totalAmount:
      pricing.priceMode === 'fixed' && seats > 1 && pricing.perSeat != null
        ? pricing.perSeat * seats
        : null,
    queuedSeats,
    queuedText: queuedSeats > 0 ? `ещё ${queuedSeats} в очереди` : null,
  }
  switch (booking.status) {
    case 'confirmed':
      return {
        ...base,
        kind: 'confirmed',
        paid: true,
        chip:
          booking.method === 'subscription'
            ? { tone: 'default', text: ORGANIZER_ROSTER_LABELS.subscription }
            : null,
        canResolvePayment: false,
      }
    case 'pending_payment': {
      const afterClose = pricing.priceMode === 'split' && !booking.paymentId
      return {
        ...base,
        kind: 'pending',
        paid: false,
        chip: afterClose
          ? { tone: 'default', text: ORGANIZER_ROSTER_LABELS.afterClose }
          : { tone: 'amber', text: ORGANIZER_ROSTER_LABELS.pending },
        canResolvePayment: !!booking.paymentId,
      }
    }
    case 'attended':
      return {
        ...base,
        kind: 'attended',
        paid: false,
        chip: { tone: 'grass', text: ORGANIZER_ROSTER_LABELS.attended },
        canResolvePayment: false,
      }
    case 'no_show':
      return {
        ...base,
        kind: 'no_show',
        paid: false,
        chip: { tone: 'rose', text: ORGANIZER_ROSTER_LABELS.noShow },
        canResolvePayment: false,
      }
    case 'waitlisted':
      return {
        ...base,
        kind: 'waitlist',
        paid: false,
        chip: { tone: 'default', text: ORGANIZER_ROSTER_LABELS.waitlist },
        canResolvePayment: false,
      }
    default:
      return { ...base, kind: 'other', paid: false, chip: null, canResolvePayment: false }
  }
}

export interface PaymentSummary {
  paid: number
  subscription: number
  pending: number
  /** split до закрытия: доля ещё не определена. */
  afterClose: number
  total: number
}

const OCCUPYING = ['confirmed', 'pending_payment', 'attended', 'no_show']

/** Оплаты по местам занятых записей (лист ожидания и отменённые не входят). */
export function paymentSummaryOf(
  bookings: readonly RosterBooking[],
  pricing: Pick<RosterPricing, 'priceMode'> = { priceMode: 'fixed' },
): PaymentSummary {
  const out: PaymentSummary = { paid: 0, subscription: 0, pending: 0, afterClose: 0, total: 0 }
  for (const b of bookings) {
    if (!OCCUPYING.includes(b.status)) continue
    const seats = Math.max(0, b.seats)
    out.total += seats
    if (b.status === 'pending_payment') {
      if (pricing.priceMode === 'split' && !b.paymentId) out.afterClose += seats
      else out.pending += seats
    } else if (b.method === 'subscription') out.subscription += seats
    else out.paid += seats
  }
  return out
}
