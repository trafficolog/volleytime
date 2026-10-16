/**
 * Строка состава у организатора (20.5.6, W-05): общий словарь и модель отображения для кабинета и
 * Mini App организатора. Организаторский словарь («в составе», «ждёт оплаты», «в очереди») отдельно
 * от игрока («Иду», `participationOf`). Только представление: серверные статусы не меняются.
 * Места — не игроки: «+N» = `seats − 1` (20.1.2), занято мест = сумма `seats`.
 */

import { formatTime } from '@volley-time/shared'

export interface RosterOffer {
  id: number
  seats: number
  expiresAt: string | Date
}

export interface RosterBooking {
  status: string
  method: string
  /** Места записи в её статусе. */
  seats: number
  /** Ещё места в очереди у записи в основе. */
  waitlistSeats: number
  /** Самый ранний живой платёж: может быть уже оплачен, решать по нему нельзя. */
  paymentId: number | null
  /** Ожидающие платежи (по одному на место): только по ним подтверждают и отклоняют. */
  pendingPaymentIds: number[]
  /** Места, оплаченные платежами (без мест абонемента). */
  paidSeats: number
  /** Зафиксированная доля split. */
  allocatedAmount: number | null
  /** Действующее предложение места из очереди (20.3.1). */
  offer: RosterOffer | null
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
  /** Бесплатное событие: «оплачено» не показываем. */
  free?: boolean
  /** split: доли уже зафиксированы. */
  settled?: boolean
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
        paid: !pricing.free,
        chip:
          booking.method === 'subscription'
            ? { tone: 'default', text: ORGANIZER_ROSTER_LABELS.subscription }
            : null,
        canResolvePayment: false,
      }
    case 'pending_payment': {
      const afterClose =
        pricing.priceMode === 'split' &&
        booking.pendingPaymentIds.length === 0 &&
        !booking.paymentId
      return {
        ...base,
        kind: 'pending',
        paid: false,
        chip: afterClose
          ? { tone: 'default', text: ORGANIZER_ROSTER_LABELS.afterClose }
          : { tone: 'amber', text: ORGANIZER_ROSTER_LABELS.pending },
        canResolvePayment: booking.pendingPaymentIds.length > 0,
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

/** Ожидающий платёж записи, по которому организатор подтверждает или отклоняет оплату. */
export const resolvablePaymentId = (booking: Pick<RosterBooking, 'pendingPaymentIds'>) =>
  booking.pendingPaymentIds[0] ?? null

/** Места абонемента: остаток сверх живых платежей (остальные места оплачены наличными/переводом). */
export function subscriptionSeatsOf(
  b: Pick<RosterBooking, 'method' | 'seats' | 'paidSeats' | 'pendingPaymentIds'>,
): number {
  return b.method === 'subscription'
    ? Math.max(0, b.seats - b.paidSeats - b.pendingPaymentIds.length)
    : 0
}

/** Оплаты по местам занятых записей (лист ожидания и отменённые не входят); смешанная запись делится по местам. */
export function paymentSummaryOf(
  bookings: readonly RosterBooking[],
  pricing: Pick<RosterPricing, 'priceMode'> = { priceMode: 'fixed' },
): PaymentSummary {
  const out: PaymentSummary = { paid: 0, subscription: 0, pending: 0, afterClose: 0, total: 0 }
  for (const b of bookings) {
    if (!OCCUPYING.includes(b.status)) continue
    const seats = Math.max(0, b.seats)
    out.total += seats
    const pending = b.pendingPaymentIds.length
    const subscription = subscriptionSeatsOf(b)
    const live = b.paidSeats + pending + subscription
    out.pending += pending
    out.subscription += subscription
    out.paid += b.paidSeats
    // места без денег: split до фиксации (доля неизвестна) либо данные без платежей (бесплатно)
    const rest = Math.max(0, seats - live)
    if (rest > 0) {
      if (pricing.priceMode === 'split' && b.status === 'pending_payment') out.afterClose += rest
      else out.paid += rest
    }
  }
  return out
}

/** Текст подтверждения отклонения оплаты: оплаченные места остаются, уходят только неоплаченные. */
export function rejectPaymentText(
  booking: RosterBooking,
  name: string,
  pricing: Pick<RosterPricing, 'priceMode' | 'settled'>,
): string {
  const kept = booking.paidSeats + subscriptionSeatsOf(booking)
  if (kept > 0)
    return `Отклонить оплату ${name}? Оплаченные места (${kept}) останутся, неоплаченные (${booking.pendingPaymentIds.length}) освободятся и уйдут в очередь.`
  return `Отклонить оплату ${name}? ${
    pricing.priceMode === 'split' && pricing.settled
      ? 'Запись будет отменена. Лист ожидания не продвигается. Доли остальных не изменятся.'
      : 'Запись будет отменена, место перейдёт следующему в листе ожидания.'
  }`
}

/** Текст подтверждения снятия записи: оплаченные места освобождаются без возврата (D-14). */
export function removeBookingText(
  name: string,
  booking: RosterBooking,
  _pricing?: Pick<RosterPricing, 'priceMode'>,
): string {
  const paid = booking.paidSeats
  return paid > 0
    ? `Снять ${name} с события? Оплаченные места (${paid}) освободятся без возврата денег: возврат — отдельное действие организатора.`
    : `Снять ${name} с события?`
}

/** «предложено до 12:30 · 2 места» — предложение места из очереди с TTL (20.3.1). */
export function offerTextOf(offer: RosterOffer | null | undefined, tz: string): string | null {
  if (!offer) return null
  return `предложено до ${formatTime(offer.expiresAt, tz)} · ${seatsWordRu(offer.seats)}`
}
