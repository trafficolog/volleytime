import { describe, expect, it } from 'vitest'

import {
  groupCreateHref,
  landingFaq,
  landingEventsWord,
  landingFeatures,
  landingPrice,
  landingPricePerEvent,
  landingPricing,
  landingPricingNotes,
  landingSections,
  telegramBotHref,
} from './landing'

describe('MVP landing public contract', () => {
  it('keeps anonymous and unknown sessions on the recoverable login path', () => {
    expect(groupCreateHref(false)).toBe('/auth/login?redirect=%2Fm%2Forgs%2Fcreate')
    expect(groupCreateHref(null)).toBe('/auth/login?redirect=%2Fm%2Forgs%2Fcreate')
    expect(groupCreateHref(true)).toBe('/m/orgs/create')
  })

  it('renders only a configured valid bot', () => {
    expect(telegramBotHref('')).toBeNull()
    expect(telegramBotHref('bad/name')).toBeNull()
    expect(telegramBotHref('@VolleyTimeBot')).toBe('https://t.me/VolleyTimeBot')
  })

  it('has real anchor targets and MVP-only copy', () => {
    expect(landingSections.map((section) => section.id)).toEqual([
      'features',
      'how-it-works',
      'faq',
    ])
    expect(landingFaq).toHaveLength(4)
    expect(landingFeatures).toHaveLength(6)
    const copy = JSON.stringify([landingFaq, landingFeatures]).toLowerCase()
    for (const claim of ['credits', 'split', '30 минут', 'напоминания по расписанию']) {
      expect(copy).not.toContain(claim)
    }
  })
})

describe('landing pricing block (24.1.4, D-10, D-11, D-19)', () => {
  const catalog = [
    { code: 'events_10', units: 10, amount: 5000, currency: 'BYN', badge: null },
    { code: 'events_30', units: 30, amount: 12000, currency: 'BYN', badge: 'popular' },
    { code: 'events_100', units: 100, amount: 35000, currency: 'BYN', badge: 'discount' },
  ] as const

  it('shows the owner-confirmed prices from the catalog as in the reference', () => {
    const rows = landingPricing(catalog)
    expect(rows.map((r) => [r.units, r.price, r.perEvent])).toEqual([
      [10, '50 Br', '5,00 Br за событие'],
      [30, '120 Br', '4,00 Br за событие'],
      [100, '350 Br', '3,50 Br за событие'],
    ])
  })

  it('uses only the catalog badge and never a computed discount percent', () => {
    const rows = landingPricing(catalog)
    expect(rows.map((r) => r.badge)).toEqual([null, 'Популярный', 'Скидка'])
    expect(rows.map((r) => r.popular)).toEqual([false, true, false])
    expect(JSON.stringify(rows)).not.toMatch(/[−-]\s?\d+\s?%/)
  })

  it('formats kopecks, rounds the price per event half-up and keeps foreign currencies', () => {
    expect(landingPrice(1250, 'BYN')).toBe('12,50 Br')
    expect(landingPrice(10000, 'USD')).toBe('100 USD')
    expect(landingPricePerEvent(1000, 3, 'BYN')).toBe('3,33 Br за событие')
    expect(landingPricePerEvent(1001, 2, 'BYN')).toBe('5,01 Br за событие')
  })

  it('names the unit «событие», never «credits» (D-10)', () => {
    expect([1, 2, 5, 11, 21, 100].map(landingEventsWord)).toEqual([
      'событие',
      'события',
      'событий',
      'событий',
      'событие',
      'событий',
    ])
    expect(
      JSON.stringify([landingPricing(catalog), landingPricingNotes]).toLowerCase(),
    ).not.toContain('credit')
  })
})
