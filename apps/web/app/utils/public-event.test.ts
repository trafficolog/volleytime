import { quoteEventPrice } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import { publicEventIcs, publicEventModel, type PublicEventPayload } from './public-event'

const NOW = new Date('2026-05-28T10:00:00Z')

const base = (): PublicEventPayload => ({
  slug: '7a1b2c3d4e5f',
  event: {
    title: 'Открытая игра',
    description: 'Микс из играющих регулярно и новых ребят.',
    status: 'published',
    startsAt: '2026-05-30T16:30:00.000Z', // 19:30 Минск
    endsAt: '2026-05-30T19:00:00.000Z', // 22:00
    place: { name: 'СК «Заслонова»', address: 'ул. Заслонова, 27' },
    capacity: 14,
    taken: 9,
    players: 9,
    full: false,
    currency: 'BYN',
    joinMode: 'open',
    bookingOpensAt: null,
  },
  group: { name: 'VolleyTime Минск', city: 'Минск', timezone: 'Europe/Minsk', memberCount: 14 },
  price: {
    ...quoteEventPrice({ mode: 'fixed', price: 1500, seats: 1, subscriptionsEnabled: true }),
    currency: 'BYN',
  },
  roster: { initials: ['АИ', 'НП', 'МС'], more: 6 },
  indexable: false,
  telegramUrl: 'https://t.me/volleytime_bot?start=event_5',
})

const split = (over: Partial<PublicEventPayload['event']> = {}, taken = 9, settled = false) => {
  const p = base()
  p.event = { ...p.event, taken, players: taken, ...over }
  p.price = {
    ...quoteEventPrice({
      mode: 'split',
      targetAmount: 21000,
      capacity: 14,
      takenSeats: taken,
      mySeats: 0,
      seats: 1,
      settled: settled ? { participantCount: taken, myAllocatedAmount: null } : null,
    }),
    currency: 'BYN',
  }
  return p
}

describe('publicEventModel (P-17)', () => {
  it('fixed: open registration, price tile, date tile in the group timezone', () => {
    const m = publicEventModel(base(), NOW)
    expect(m.state).toBe('open')
    expect(m.statusChip).toBe('Открытая запись')
    expect(m.cta).toEqual({ label: 'Записаться через Telegram', href: base().telegramUrl })
    expect(m.dateTile).toEqual({ label: 'Суббота', value: '30 мая', sub: '19:30 — 22:00' })
    expect(m.priceTile).toEqual({ label: 'Цена', value: '15,00 BYN', sub: 'за одно место' })
    expect(m.priceChip).toBeNull()
    expect(m.priceNote).toBe('Войдёшь в Telegram — попадёшь в свою запись. Никакой регистрации.')
    expect(m.seats).toMatchObject({ taken: 9, capacity: 14, full: false })
    expect(m.rosterLine).toBe('и ещё 6')
  })

  it('free event says «Бесплатно»', () => {
    const p = base()
    p.price = {
      ...quoteEventPrice({ mode: 'fixed', price: 0, seats: 1, subscriptionsEnabled: true }),
      currency: 'BYN',
    }
    expect(publicEventModel(p, NOW).priceTile!.value).toBe('Бесплатно')
  })

  it('split forecast: ≈ share now, full-roster price as the subline, total in the chip', () => {
    const m = publicEventModel(split(), NOW)
    const forecast = quoteEventPrice({
      mode: 'split',
      targetAmount: 21000,
      capacity: 14,
      takenSeats: 9,
      mySeats: 0,
      seats: 1,
      settled: null,
    })
    expect(forecast.perSeat.min).toBe(1500)
    expect(m.priceTile).toEqual({
      label: 'Цена · делим сумму',
      value: '≈ 21,00 BYN', // прогноз для следующего игрока: 210 ÷ (9 + 1), как у GET …/price
      sub: 'при полном составе — 15,00 BYN',
    })
    expect(m.priceChip).toBe('Делим сумму 210,00 BYN')
    expect(m.priceNote).toContain('чем больше запишется')
    expect(m.splitExplainer).toMatchObject({
      title: 'Как считается цена',
      divider: '210,00 BYN ÷ 10 мест',
    })
    expect(m.splitExplainer!.scenarios.length).toBeGreaterThan(1)
  })

  it('split settled: final share per person, explainer says «Как посчитана цена»', () => {
    const m = publicEventModel(split({ status: 'closed' }, 12, true), NOW)
    expect(m.state).toBe('closed')
    expect(m.priceTile).toEqual({
      label: 'Итог с человека',
      value: '17,50 BYN',
      sub: '210,00 BYN ÷ 12 мест',
    })
    expect(m.statusChip).toBe('Запись закрыта')
    expect(m.cta.label).toBe('Открыть в Telegram')
    expect(m.splitExplainer!.title).toBe('Как посчитана цена')
    expect(m.splitExplainer!.scenarios).toEqual([])
  })

  it('«мест нет» comes from occupancy, not from the price', () => {
    const p = split({ taken: 14, players: 14, full: true }, 14)
    expect(p.price!.seatCount).toEqual({ current: 14, max: 14 })
    const m = publicEventModel(p, NOW)
    expect(m.seats.text).toBe('мест нет')
    expect(m.seats.full).toBe(true)
    expect(m.cta.label).toBe('В лист ожидания через Telegram')
    // событие закончилось — вместо «мест нет» состояние, шкала серая
    const past = publicEventModel(p, new Date('2026-06-01T00:00:00Z'))
    expect(past.state).toBe('past')
    expect(past.seats.text).toBe('14/14')
  })

  it('cancelled: state, no price tile, no price note, no booking CTA wording', () => {
    const p = split({ status: 'cancelled' })
    p.price = null
    const m = publicEventModel(p, NOW)
    expect(m.state).toBe('cancelled')
    expect(m.statusChip).toBe('Событие отменено')
    expect(m.priceTile).toBeNull()
    expect(m.priceChip).toBeNull()
    expect(m.splitExplainer).toBeNull()
    expect(m.cta.label).toBe('Открыть в Telegram')
  })

  it('invite-only: says so, never offers direct registration', () => {
    const p = base()
    p.event.joinMode = 'invite'
    p.roster = { initials: [], more: 0 }
    const m = publicEventModel(p, NOW)
    expect(m.state).toBe('invite')
    expect(m.statusChip).toBe('Запись по приглашению')
    expect(m.cta.label).toBe('Открыть в Telegram')
    expect(m.rosterLine).toBeNull()
  })

  it('booking not opened yet', () => {
    const p = base()
    p.event.bookingOpensAt = '2026-05-29T07:00:00.000Z'
    const m = publicEventModel(p, NOW)
    expect(m.state).toBe('opens_later')
    expect(m.statusChip).toBe('Запись откроется 29 мая, 10:00')
  })

  it('no Telegram link when the bot is not configured', () => {
    const p = base()
    p.telegramUrl = null
    expect(publicEventModel(p, NOW).cta.href).toBeNull()
  })

  it('page title and description for SEO', () => {
    const m = publicEventModel(base(), NOW)
    expect(m.seoTitle).toBe('Открытая игра — 30 мая, 19:30 · VolleyTime Минск')
    expect(m.seoDescription).toBe(
      'Суббота, 30 мая, 19:30 — 22:00. СК «Заслонова». Мест занято 9 из 14.',
    )
  })
})

describe('publicEventIcs', () => {
  it('builds a calendar entry in UTC with escaped text and no player data', () => {
    const p = base()
    p.event.title = 'Игра; тест, раз'
    const ics = publicEventIcs(p, NOW)
    expect(ics).toContain('BEGIN:VCALENDAR\r\n')
    expect(ics).toContain('UID:7a1b2c3d4e5f@volleytime\r\n')
    expect(ics).toContain('DTSTAMP:20260528T100000Z\r\n')
    expect(ics).toContain('DTSTART:20260530T163000Z\r\n')
    expect(ics).toContain('DTEND:20260530T190000Z\r\n')
    expect(ics).toContain('SUMMARY:Игра\\; тест\\, раз\r\n')
    expect(ics).toContain('LOCATION:СК «Заслонова»\\, ул. Заслонова\\, 27\r\n')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})
