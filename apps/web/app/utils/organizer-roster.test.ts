import { describe, expect, it } from 'vitest'

import {
  ORGANIZER_ROSTER_LABELS,
  offerTextOf,
  paymentSummaryOf,
  rejectPaymentText,
  removeBookingText,
  resolvablePaymentId,
  rosterRowOf,
  seatsWordRu,
  subscriptionSeatsOf,
  type RosterBooking,
} from './organizer-roster'

const booking = (over: Partial<RosterBooking> = {}): RosterBooking => ({
  status: 'confirmed',
  method: 'cash',
  seats: 1,
  waitlistSeats: 0,
  paymentId: null,
  pendingPaymentIds: [],
  paidSeats: 1,
  allocatedAmount: null,
  offer: null,
  ...over,
})
const fixed = { priceMode: 'fixed' as const }
const split = { priceMode: 'split' as const }

describe('rosterRowOf: словарь организатора (не «Иду» игрока)', () => {
  it('подтверждённая запись — галочка оплаты, без чипа и без «+N»', () => {
    const row = rosterRowOf(booking(), fixed)
    expect(row.kind).toBe('confirmed')
    expect(row.paid).toBe(true)
    expect(row.chip).toBeNull()
    expect(row.extraSeats).toBe(0)
    expect(row.seatsText).toBeNull()
  })

  it('бесплатное событие: «оплачено» не показываем', () => {
    const row = rosterRowOf(booking({ paidSeats: 0 }), { priceMode: 'fixed', free: true })
    expect(row.paid).toBe(false)
    expect(row.chip).toBeNull()
  })

  it('абонемент — нейтральный чип «абон.»', () => {
    expect(rosterRowOf(booking({ method: 'subscription', paidSeats: 0 }), fixed).chip).toEqual({
      tone: 'default',
      text: ORGANIZER_ROSTER_LABELS.subscription,
    })
  })

  it('ждёт оплаты — янтарный чип; действовать можно только по ожидающему платежу', () => {
    const withPayment = rosterRowOf(
      booking({ status: 'pending_payment', paymentId: 5, pendingPaymentIds: [5], paidSeats: 0 }),
      fixed,
    )
    expect(withPayment.chip).toEqual({ tone: 'amber', text: 'ждёт оплаты' })
    expect(withPayment.canResolvePayment).toBe(true)
    expect(withPayment.paid).toBe(false)
    // paymentId указывает на уже оплаченный платёж, ожидающих нет — решать нечего
    expect(
      rosterRowOf(
        booking({ status: 'pending_payment', paymentId: 4, pendingPaymentIds: [] }),
        fixed,
      ).canResolvePayment,
    ).toBe(false)
  })

  it('split до закрытия без платежа — «сумма после закрытия», не «ждёт оплаты»', () => {
    const row = rosterRowOf(booking({ status: 'pending_payment', paidSeats: 0 }), split)
    expect(row.chip).toEqual({ tone: 'default', text: 'сумма после закрытия' })
    expect(row.canResolvePayment).toBe(false)
  })

  it('был / не пришёл / очередь', () => {
    expect(rosterRowOf(booking({ status: 'attended' }), fixed).chip).toEqual({
      tone: 'grass',
      text: 'был',
    })
    expect(rosterRowOf(booking({ status: 'no_show' }), fixed).chip).toEqual({
      tone: 'rose',
      text: 'не пришёл',
    })
    const queued = rosterRowOf(booking({ status: 'waitlisted', seats: 2 }), fixed)
    expect(queued.kind).toBe('waitlist')
    expect(queued.chip).toEqual({ tone: 'default', text: 'в очереди' })
  })

  it('несколько мест: «+N» = места − 1, подпись «N места», суммарная цена из переданной цены места', () => {
    const row = rosterRowOf(booking({ seats: 3 }), { priceMode: 'fixed', perSeat: 1500 })
    expect(row.extraSeats).toBe(2)
    expect(row.seatsText).toBe('3 места')
    expect(row.totalAmount).toBe(4500)
  })

  it('суммарная цена не выдумывается для split и при неизвестной цене', () => {
    expect(rosterRowOf(booking({ seats: 2 }), split).totalAmount).toBeNull()
    expect(rosterRowOf(booking({ seats: 2 }), fixed).totalAmount).toBeNull()
  })

  it('частичная очередь у записи в основе: «ещё N в очереди»', () => {
    const row = rosterRowOf(booking({ seats: 2, waitlistSeats: 3 }), fixed)
    expect(row.queuedSeats).toBe(3)
    expect(row.queuedText).toBe('ещё 3 в очереди')
  })

  it('записи без мест и мусорные значения не дают отрицательного «+N»', () => {
    expect(rosterRowOf(booking({ seats: 0 }), fixed).extraSeats).toBe(0)
  })
})

describe('resolvablePaymentId', () => {
  it('берёт ожидающий платёж, а не booking.paymentId (оплаченный первым)', () => {
    const b = booking({
      status: 'pending_payment',
      seats: 3,
      paymentId: 10,
      paidSeats: 2,
      pendingPaymentIds: [12],
    })
    expect(resolvablePaymentId(b)).toBe(12)
    expect(resolvablePaymentId(booking())).toBeNull()
  })
})

describe('seatsWordRu', () => {
  it.each([
    [1, '1 место'],
    [2, '2 места'],
    [5, '5 мест'],
    [11, '11 мест'],
    [21, '21 место'],
    [22, '22 места'],
  ])('%i', (n, text) => expect(seatsWordRu(n)).toBe(text))
})

describe('subscriptionSeatsOf: места абонемента — остаток сверх живых платежей', () => {
  it('смешанная запись: 3 места, 1 занятие и 2 наличных', () => {
    expect(
      subscriptionSeatsOf(
        booking({ method: 'subscription', seats: 3, paidSeats: 1, pendingPaymentIds: [7] }),
      ),
    ).toBe(1)
    expect(subscriptionSeatsOf(booking({ method: 'cash', seats: 2 }))).toBe(0)
  })
})

describe('paymentSummaryOf: места, а не игроки', () => {
  it('считает оплачено / абонемент / ждут по местам', () => {
    const summary = paymentSummaryOf([
      booking({ seats: 2, paidSeats: 2 }),
      booking({ method: 'subscription', seats: 1, paidSeats: 0 }),
      booking({
        status: 'pending_payment',
        seats: 3,
        paymentId: 9,
        paidSeats: 0,
        pendingPaymentIds: [9, 10, 11],
      }),
      booking({ status: 'attended', seats: 1 }),
      booking({ status: 'waitlisted', seats: 4, paidSeats: 0 }),
      booking({ status: 'cancelled', seats: 1 }),
    ])
    expect(summary).toEqual({ paid: 3, subscription: 1, pending: 3, afterClose: 0, total: 7 })
  })

  it('смешанная запись делится по местам: 1 занятие, 1 оплачено наличными, 1 ждёт', () => {
    const summary = paymentSummaryOf([
      booking({
        method: 'subscription',
        status: 'pending_payment',
        seats: 3,
        paidSeats: 1,
        pendingPaymentIds: [4],
      }),
    ])
    expect(summary).toEqual({ paid: 1, subscription: 1, pending: 1, afterClose: 0, total: 3 })
  })

  it('оплаченное первым и ожидающее вторым: места делятся, а не относятся к одной категории', () => {
    const summary = paymentSummaryOf([
      booking({
        status: 'pending_payment',
        seats: 3,
        paymentId: 1,
        paidSeats: 2,
        pendingPaymentIds: [3],
      }),
    ])
    expect(summary).toEqual({ paid: 2, subscription: 0, pending: 1, afterClose: 0, total: 3 })
  })

  it('split без платежа не считается «ждёт оплаты» по месту — отдельная доля', () => {
    const summary = paymentSummaryOf(
      [booking({ status: 'pending_payment', seats: 2, paidSeats: 0 })],
      split,
    )
    expect(summary).toEqual({ paid: 0, subscription: 0, pending: 0, afterClose: 2, total: 2 })
  })
})

describe('rejectPaymentText', () => {
  const pending = booking({
    status: 'pending_payment',
    seats: 3,
    paidSeats: 2,
    paymentId: 1,
    pendingPaymentIds: [3],
  })

  it('есть оплаченные места сверх ожидающих: они остаются, неоплаченные уходят в очередь', () => {
    const text = rejectPaymentText(pending, 'Артём', fixed)
    expect(text).toContain('Оплаченные места (2) останутся')
    expect(text).toContain('неоплаченные (1)')
    expect(text).toContain('очередь')
    expect(text).not.toContain('Запись будет отменена')
  })

  it('места абонемента тоже остаются', () => {
    const text = rejectPaymentText(
      booking({
        method: 'subscription',
        status: 'pending_payment',
        seats: 2,
        paidSeats: 0,
        pendingPaymentIds: [3],
      }),
      'Артём',
      fixed,
    )
    expect(text).toContain('Оплаченные места (1) останутся')
  })

  it('без оплаченных мест — прежний текст: запись отменяется', () => {
    const text = rejectPaymentText(
      booking({ status: 'pending_payment', seats: 1, paidSeats: 0, pendingPaymentIds: [3] }),
      'Артём',
      fixed,
    )
    expect(text).toBe(
      'Отклонить оплату Артём? Запись будет отменена, место перейдёт следующему в листе ожидания.',
    )
  })

  it('split после фиксации: лист ожидания не продвигается', () => {
    const text = rejectPaymentText(
      booking({ status: 'pending_payment', paidSeats: 0, pendingPaymentIds: [3] }),
      'Артём',
      { priceMode: 'split', settled: true },
    )
    expect(text).toContain('Лист ожидания не продвигается')
  })
})

describe('removeBookingText', () => {
  it('упоминает оплаченные места, которые освобождаются без возврата (D-14)', () => {
    expect(removeBookingText('Артём', booking({ seats: 2, paidSeats: 2 }))).toContain(
      'без возврата',
    )
    expect(removeBookingText('Артём', booking({ status: 'pending_payment', paidSeats: 0 }))).toBe(
      'Снять Артём с события?',
    )
  })
})

describe('offerTextOf: предложение места из очереди', () => {
  it('«предложено до HH:MM» в часовом поясе группы', () => {
    const text = offerTextOf({ id: 1, seats: 2, expiresAt: '2099-10-01T09:30:00Z' }, 'Europe/Minsk')
    expect(text).toBe('предложено до 12:30 · 2 места')
  })

  it('нет предложения — нет текста', () => {
    expect(offerTextOf(null, 'Europe/Minsk')).toBeNull()
  })
})
