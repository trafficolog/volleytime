import { quoteEventPrice, type EventPriceQuote } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import { seatsLabel } from './booking-seats'
import { formatMoneyRu } from './labels'
import { playerSplitViewOf, quotePriceLabel } from './player-price-view'

const open = { status: 'published', startsAt: '2099-01-01T10:00:00Z', capacity: 14, taken: 8 }
const money = (minor: number) => formatMoneyRu(minor, 'BYN')
const NOW = new Date('2098-01-01T00:00:00Z')
const idle = { hasBooking: false, paid: false }

const forecast = (taken = 8, mySeats = 0, seats = 1, target = 10000, capacity = 14) =>
  quoteEventPrice({
    mode: 'split',
    targetAmount: target,
    capacity,
    takenSeats: taken,
    mySeats,
    seats,
    settled: null,
  })
const settled = (participants = 3, mine: number | null = 3334, mySeats = 1, seats = 1) =>
  quoteEventPrice({
    mode: 'split',
    targetAmount: 10000,
    capacity: 14,
    takenSeats: participants,
    mySeats,
    seats,
    settled: { participantCount: participants, myAllocatedAmount: mine },
  })

describe('playerSplitViewOf: цена split только из ответа GET …/price', () => {
  it('до закрытия: цель сбора, прогноз «от … до …» и пометка про абонемент', () => {
    const quote = forecast()
    const view = playerSplitViewOf(quote, 'BYN', open, NOW, idle)!
    expect(view.stage).toBe('open')
    expect(view.eyebrow).toBe('Делим общую сумму')
    expect(view.chip).toEqual({ text: 'предварительно', tone: 'amber' })
    expect(view.headline).toBe(`≈ ${money(quote.perSeat.max)}`)
    expect(view.rangeText).toBe(`от ${money(quote.perSeat.min)} до ${money(quote.perSeat.max)}`)
    expect(view.divider).toBe(`${money(10000)} ÷ ${seatsLabel(quote.seatCount!.current)} с вами`)
    expect(view.headlineNote).toBe('если запишетесь')
    expect(view.subscriptionNote).toBe('Абонемент к событию со сбором суммой не применяется')
    expect(view.myTotal).toBeNull()
    expect(view.scenarios[0]).toMatchObject({ seats: quote.seatCount!.current, current: true })
    // занято 8 из 9 «мест с вами»
    expect(view.scenarios[0]!.meterPct).toBe(89)
    expect(view.scenarios.at(-1)!.meterPct).toBeLessThan(100)
  })

  it('прогноз обновляется с новой записью: больше мест в делителе, меньше доля', () => {
    const before = playerSplitViewOf(forecast(8), 'BYN', open, NOW, idle)!
    const after = playerSplitViewOf(forecast(9), 'BYN', { ...open, taken: 9 }, NOW, idle)!
    expect(before.divider).toContain('÷ 9 мест с вами')
    expect(after.divider).toContain('÷ 10 мест с вами')
    expect(after.headline).not.toBe(before.headline)
  })

  it('после закрытия: итоговая доля и «с вас» за все места игрока, без «≈»', () => {
    const quote = settled(3, 6667, 2, 2)
    const closed = { ...open, status: 'closed' }
    const view = playerSplitViewOf(quote, 'BYN', closed, NOW, { hasBooking: true, paid: false })!
    expect(view.stage).toBe('settled')
    expect(view.eyebrow).toBe('Итоговый расчёт')
    expect(view.chip).toEqual({ text: 'зафиксировано', tone: 'grass' })
    expect(view.headline.startsWith('≈')).toBe(false)
    expect(view.rangeText).toBeNull()
    expect(view.scenarios).toEqual([])
    expect(view.myTotal).toEqual({ text: money(quote.total.max), seats: 2 })
  })

  it('оплачено: состояние «Оплачено», сумма за места остаётся для компонента', () => {
    const closed = { ...open, status: 'closed' }
    const view = playerSplitViewOf(settled(), 'BYN', closed, NOW, { hasBooking: true, paid: true })!
    expect(view.stage).toBe('paid')
    expect(view.chip).toEqual({ text: 'оплачено', tone: 'grass' })
    expect(view.myTotal).toEqual({ text: money(settled().total.max), seats: 1 })
  })

  it('зафиксировано, но игрока нет в составе: доля участника без «с вас»', () => {
    const quote = settled(3, null, 0)
    const closed = { ...open, status: 'closed' }
    const view = playerSplitViewOf(quote, 'BYN', closed, NOW, idle)!
    expect(view.headline).toBe(money(quote.perSeat.max))
    expect(view.myTotal).toBeNull()
  })

  it('записан: без «если запишетесь»; в листе ожидания: «если получите место»', () => {
    const booked = playerSplitViewOf(forecast(8, 1), 'BYN', open, NOW, {
      hasBooking: true,
      paid: false,
    })!
    expect(booked.headlineNote).toBeNull()
    expect(booked.divider).toBe(`${money(10000)} ÷ 8 мест`)
    const queued = playerSplitViewOf(forecast(14), 'BYN', { ...open, taken: 14 }, NOW, {
      hasBooking: false,
      waitlisted: true,
    })!
    expect(queued.headlineNote).toBe('если получите место')
    expect(
      quotePriceLabel(forecast(14), 'BYN', { hasBooking: false, waitlisted: true })!.text,
    ).toContain(', если получите место')
  })

  it('шкала считает занятые места, а не места «с вами»; склонение места/места/мест', () => {
    const none = playerSplitViewOf(forecast(0), 'BYN', { ...open, taken: 0 }, NOW, idle)!
    expect(none.divider).toBe(`${money(10000)} ÷ 1 место с вами`)
    expect(none.scenarios[0]!.meterPct).toBe(0)
    const some = playerSplitViewOf(forecast(8), 'BYN', open, NOW, idle)!
    // текущая строка — 9 мест (8 занято + я): занято 8 из 9
    expect(some.scenarios[0]).toMatchObject({ seats: 9, meterPct: 89 })
    const two = playerSplitViewOf(forecast(1), 'BYN', { ...open, taken: 1 }, NOW, idle)!
    expect(two.divider).toBe(`${money(10000)} ÷ 2 места с вами`)
  })

  it('«мест нет» — по занятости события, а не по цене', () => {
    const quote = forecast(14)
    expect(quote.seatCount!.current).toBe(14)
    expect(playerSplitViewOf(quote, 'BYN', { ...open, taken: 14 }, NOW, idle)!.full).toBe(true)
    expect(playerSplitViewOf(quote, 'BYN', { ...open, taken: 13 }, NOW, idle)!.full).toBe(false)
  })

  it('отменённое событие, нет ответа цены и fixed — без блока', () => {
    expect(
      playerSplitViewOf(forecast(), 'BYN', { ...open, status: 'cancelled' }, NOW, idle),
    ).toBeNull()
    expect(playerSplitViewOf(null, 'BYN', open, NOW, idle)).toBeNull()
    const fixed = quoteEventPrice({
      mode: 'fixed',
      price: 1500,
      seats: 1,
      subscriptionsEnabled: false,
    })
    expect(playerSplitViewOf(fixed, 'BYN', open, NOW, idle)).toBeNull()
  })
})

describe('quotePriceLabel: цена Главной совпадает с ответом эндпоинта', () => {
  const cases: [string, EventPriceQuote, boolean][] = [
    ['прогноз при 0 записавшихся', forecast(0), false],
    ['прогноз по текущему составу', forecast(8, 1), true],
    ['прогноз при полном составе', forecast(14), false],
    ['несколько мест', forecast(8, 2, 2), true],
    ['зафиксировано, моя доля', settled(3, 3334), true],
    ['зафиксировано, не участник', settled(3, null, 0), false],
  ]
  it.each(cases)('%s', (_name, quote, hasBooking) => {
    const label = quotePriceLabel(quote, 'BYN', { hasBooking })!
    if (quote.basis === 'settled') {
      const shown = hasBooking ? quote.total.max : quote.perSeat.max
      expect(label.text).toBe(money(shown))
    } else {
      expect(label.text).toBe(
        `≈ ${money(quote.perSeat.max)}${hasBooking ? '' : ', если запишетесь'}`,
      )
      if (quote.perSeat.min !== quote.perSeat.max)
        expect(label.description).toContain(
          `От ${money(quote.perSeat.min)} до ${money(quote.perSeat.max)}`,
        )
      expect(label.description).toContain('закроет запись')
    }
  })
  it('нет ответа цены или fixed — null, а не число из другого расчёта', () => {
    expect(quotePriceLabel(null, 'BYN', { hasBooking: false })).toBeNull()
    const fixed = quoteEventPrice({
      mode: 'fixed',
      price: 1500,
      seats: 1,
      subscriptionsEnabled: false,
    })
    expect(quotePriceLabel(fixed, 'BYN', { hasBooking: false })).toBeNull()
  })
})
