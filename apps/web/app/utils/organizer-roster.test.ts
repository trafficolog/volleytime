import { describe, expect, it } from 'vitest'

import {
  ORGANIZER_ROSTER_LABELS,
  paymentSummaryOf,
  rosterRowOf,
  seatsWordRu,
  type RosterBooking,
} from './organizer-roster'

const booking = (over: Partial<RosterBooking> = {}): RosterBooking => ({
  status: 'confirmed',
  method: 'cash',
  seats: 1,
  waitlistSeats: 0,
  paymentId: null,
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

  it('абонемент — нейтральный чип «абон.»', () => {
    expect(rosterRowOf(booking({ method: 'subscription' }), fixed).chip).toEqual({
      tone: 'default',
      text: ORGANIZER_ROSTER_LABELS.subscription,
    })
  })

  it('ждёт оплаты — янтарный чип; платёж можно подтвердить только при paymentId', () => {
    const withPayment = rosterRowOf(booking({ status: 'pending_payment', paymentId: 5 }), fixed)
    expect(withPayment.chip).toEqual({ tone: 'amber', text: 'ждёт оплаты' })
    expect(withPayment.canResolvePayment).toBe(true)
    expect(withPayment.paid).toBe(false)
    expect(
      rosterRowOf(booking({ status: 'pending_payment', paymentId: null }), fixed).canResolvePayment,
    ).toBe(false)
  })

  it('split до закрытия без платежа — «сумма после закрытия», не «ждёт оплаты»', () => {
    const row = rosterRowOf(booking({ status: 'pending_payment' }), split)
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

describe('paymentSummaryOf: места, а не игроки', () => {
  it('считает оплачено / абонемент / ждут по местам', () => {
    const summary = paymentSummaryOf([
      booking({ seats: 2 }),
      booking({ method: 'subscription', seats: 1 }),
      booking({ status: 'pending_payment', seats: 3, paymentId: 9 }),
      booking({ status: 'attended', seats: 1 }),
      booking({ status: 'waitlisted', seats: 4 }),
      booking({ status: 'cancelled', seats: 1 }),
    ])
    expect(summary).toEqual({ paid: 3, subscription: 1, pending: 3, afterClose: 0, total: 7 })
  })

  it('split без платежа не считается «ждёт оплаты» по месту — отдельная доля', () => {
    const summary = paymentSummaryOf([booking({ status: 'pending_payment', seats: 2 })], split)
    expect(summary).toEqual({ paid: 0, subscription: 0, pending: 0, afterClose: 2, total: 2 })
  })
})
