import { quoteEventPrice } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import { priceViewOf } from './event-price-view'
import { formatMoneyRu } from './labels'

const open = { status: 'published', startsAt: '2099-01-01T10:00:00Z', capacity: 14, taken: 8 }

const forecast = (taken = 8, capacity = 14, target = 10000) =>
  quoteEventPrice({
    mode: 'split',
    targetAmount: target,
    capacity,
    takenSeats: taken,
    mySeats: 0,
    seats: 1,
    settled: null,
  })

describe('priceViewOf: цена только из ответа GET …/price (quoteEventPrice)', () => {
  it('fixed: показывает цену места из ответа, без прогноза', () => {
    const quote = quoteEventPrice({
      mode: 'fixed',
      price: 1500,
      seats: 1,
      subscriptionsEnabled: false,
    })
    const view = priceViewOf(quote, 'BYN', open)!
    expect(view.headline).toBe(formatMoneyRu(1500, 'BYN'))
    expect(view.scenarios).toEqual([])
    expect(view.divider).toBeNull()
  })

  it('split-прогноз: заголовок и диапазон совпадают с ответом эндпоинта', () => {
    const quote = forecast()
    const view = priceViewOf(quote, 'BYN', open)!
    expect(view.basis).toBe('forecast')
    expect(view.headline).toBe(`≈ ${formatMoneyRu(quote.perSeat.max, 'BYN')}`)
    expect(view.rangeText).toBe(
      `от ${formatMoneyRu(quote.perSeat.min, 'BYN')} до ${formatMoneyRu(quote.perSeat.max, 'BYN')}`,
    )
    expect(view.divider).toBe(`${formatMoneyRu(10000, 'BYN')} ÷ ${quote.seatCount!.current} мест`)
  })

  it('доли сбора по наполнению: первая колонка равна верхней границе ответа, каждая — доле при n местах', () => {
    const quote = forecast()
    const view = priceViewOf(quote, 'BYN', open)!
    expect(view.scenarios[0]).toMatchObject({
      seats: quote.seatCount!.current,
      amount: formatMoneyRu(quote.perSeat.max, 'BYN'),
      current: true,
    })
    const last = view.scenarios.at(-1)!
    expect(last.seats).toBe(14)
    // тот же расчёт при полном составе: доля при вместимости (цель ÷ 14, до копейки вверх)
    expect(last.amount).toBe(formatMoneyRu(forecast(14, 14).perSeat.max, 'BYN'))
    expect(view.rangeText).toContain(formatMoneyRu(quote.perSeat.min, 'BYN'))
    // возрастающее число мест, без дублей
    const seats = view.scenarios.map((s) => s.seats)
    expect(seats).toEqual([...new Set(seats)].sort((a, b) => a - b))
  })

  it('доли сбора не теряют копейки: сумма долей по местам равна цели (D-01)', () => {
    const quote = forecast(7, 7, 10001)
    const view = priceViewOf(quote, 'BYN', { ...open, capacity: 7, taken: 7 })!
    // 10001 / 7: верхняя доля 1429, нижняя 1428
    expect(view.rangeText).toBe(`от ${formatMoneyRu(1428, 'BYN')} до ${formatMoneyRu(1429, 'BYN')}`)
  })

  it('«мест нет» берётся из занятости события, а не из цены (ревью 20.1.1)', () => {
    // seatCount.current ограничен вместимостью: цена полного состава совпадает с ценой «сейчас»
    const quote = forecast(14, 14)
    expect(quote.seatCount!.current).toBe(14)
    expect(priceViewOf(quote, 'BYN', { ...open, taken: 14 })!.full).toBe(true)
    expect(priceViewOf(quote, 'BYN', { ...open, taken: 13 })!.full).toBe(false)
  })

  it('закрытое событие не называется «мест нет»: состояние события важнее', () => {
    expect(
      priceViewOf(forecast(14, 14), 'BYN', { ...open, taken: 14, status: 'closed' })!.full,
    ).toBe(false)
  })

  it('отменённое событие: цену не показываем, хотя эндпоинт по-прежнему отдаёт прогноз', () => {
    expect(priceViewOf(forecast(), 'BYN', { ...open, status: 'cancelled' })).toBeNull()
  })

  it('зафиксированная доля — без «≈» и без сценариев', () => {
    const quote = quoteEventPrice({
      mode: 'split',
      targetAmount: 10000,
      capacity: 14,
      takenSeats: 8,
      mySeats: 0,
      seats: 1,
      settled: { participantCount: 8, myAllocatedAmount: null },
    })
    const view = priceViewOf(quote, 'BYN', open)!
    expect(view.basis).toBe('settled')
    expect(view.headline.startsWith('≈')).toBe(false)
    expect(view.scenarios).toEqual([])
  })

  it('нет ответа цены — нет блока', () => {
    expect(priceViewOf(null, 'BYN', open)).toBeNull()
  })
})
