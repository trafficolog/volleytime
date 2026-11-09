import { describe, expect, it } from 'vitest'

import {
  balanceSubtitle,
  entryDate,
  entryView,
  formatDelta,
  lowBalanceWarning,
  packageViews,
  type BalanceEntry,
  type BalancePackage,
} from './event-balance-billing'

const PACKAGES: BalancePackage[] = [
  { code: 'events_10', units: 10, amount: 5000, currency: 'BYN', popular: false },
  { code: 'events_30', units: 30, amount: 12000, currency: 'BYN', popular: true },
  { code: 'events_100', units: 100, amount: 35000, currency: 'BYN', popular: false },
]

function entry(over: Partial<BalanceEntry> = {}): BalanceEntry {
  return {
    id: 1,
    delta: -1,
    reason: 'spend',
    balanceAfter: 31,
    actorKind: 'user',
    author: { id: 5, name: 'Организатор' },
    source: null,
    comment: null,
    event: { id: 9, title: 'Основа · 28 мая', startsAt: '2026-05-28T16:00:00.000Z' },
    purchaseRequestId: null,
    createdAt: '2026-05-25T10:00:00.000Z',
    ...over,
  }
}

describe('balance packages (W-12, D-11)', () => {
  it('shows price per event in minor-unit-exact arithmetic and the discount against the smallest package', () => {
    const views = packageViews(PACKAGES)
    expect(views.map((v) => v.perUnit)).toEqual(['5,00 BYN', '4,00 BYN', '3,50 BYN'])
    expect(views.map((v) => v.price)).toEqual(['50,00 BYN', '120,00 BYN', '350,00 BYN'])
    expect(views.map((v) => v.badge)).toEqual([null, 'Популярный', '−30%'])
    expect(views.map((v) => v.unitsCaption)).toEqual(['событий', 'событий', 'событий'])
  })

  it('never shows a discount badge for the base package or a package that is not cheaper', () => {
    const views = packageViews([
      { code: 'events_10', units: 10, amount: 5000, currency: 'BYN', popular: false },
      { code: 'events_30', units: 30, amount: 15000, currency: 'BYN', popular: false },
    ])
    expect(views.map((v) => v.badge)).toEqual([null, null])
  })

  it('rounds the discount to a whole percent and handles an empty catalog', () => {
    const views = packageViews([
      { code: 'events_10', units: 10, amount: 5000, currency: 'BYN', popular: false },
      { code: 'events_100', units: 100, amount: 34900, currency: 'BYN', popular: false },
    ])
    expect(views[1]!.badge).toBe('−30%')
    expect(packageViews([])).toEqual([])
  })
})

describe('balance wording (D-10)', () => {
  it('counts events with the right plural and never says credits', () => {
    expect(balanceSubtitle(32)).toBe('32 события на балансе')
    expect(balanceSubtitle(1)).toBe('1 событие на балансе')
    expect(balanceSubtitle(48)).toBe('48 событий на балансе')
    expect(balanceSubtitle(0)).toBe('0 событий на балансе')
    expect(balanceSubtitle(null)).toBe('Баланс событий')
  })

  it('warns when the balance is running out with the threshold wording', () => {
    expect(lowBalanceWarning({ balance: 8, low: true })).toBe(
      'Баланс заканчивается: осталось 8 событий. Пополните баланс, чтобы публиковать новые события.',
    )
    expect(lowBalanceWarning({ balance: 1, low: true })).toContain('осталось 1 событие.')
    expect(lowBalanceWarning({ balance: 0, low: true })).toBe(
      'Баланс исчерпан. Пополните баланс, чтобы публиковать новые события.',
    )
    expect(lowBalanceWarning({ balance: 32, low: false })).toBeNull()
    expect(lowBalanceWarning(null)).toBeNull()
  })

  it('signs deltas', () => {
    expect(formatDelta(30)).toBe('+30')
    expect(formatDelta(-1)).toBe('−1')
    expect(formatDelta(0)).toBe('0')
  })
})

describe('entry date', () => {
  it('uses the group time zone and adds the year only for past years', () => {
    const now = new Date('2026-06-01T10:00:00Z')
    expect(entryDate('2026-05-25T10:00:00.000Z', 'Europe/Minsk', now)).toBe('25 мая')
    expect(entryDate('2026-05-24T22:30:00.000Z', 'Europe/Minsk', now)).toBe('25 мая')
    expect(entryDate('2025-12-31T10:00:00.000Z', 'Europe/Minsk', now)).toBe('31 декабря 2025')
  })
})

describe('history rows (W-12)', () => {
  it('describes every reason in the owner vocabulary', () => {
    expect(entryView(entry())).toMatchObject({
      chip: 'списание',
      title: 'Событие «Основа · 28 мая»',
      delta: '−1',
      positive: false,
    })
    expect(
      entryView(entry({ reason: 'purchase', delta: 30, event: null, purchaseRequestId: 4 })),
    ).toMatchObject({ chip: 'покупка', title: 'Пакет 30 событий', delta: '+30', positive: true })
    expect(entryView(entry({ reason: 'refund', delta: 1 }))).toMatchObject({
      chip: 'возврат',
      title: 'Возврат · отменено событие «Основа · 28 мая»',
    })
    expect(entryView(entry({ reason: 'demo_grant', delta: 5, event: null }))).toMatchObject({
      chip: 'начисление',
      title: 'Стартовые события от платформы',
    })
    expect(entryView(entry({ reason: 'pilot_grant', delta: 48, event: null }))).toMatchObject({
      chip: 'начисление',
      title: 'Стартовый баланс группы',
    })
    expect(entryView(entry({ reason: 'grant', delta: 10, event: null }))).toMatchObject({
      chip: 'начисление',
      title: 'Начисление от платформы',
    })
    expect(entryView(entry({ reason: 'correction', delta: -2, event: null }))).toMatchObject({
      chip: 'корректировка',
      title: 'Корректировка баланса',
    })
  })

  it('shows the operator comment and falls back when the event was deleted', () => {
    expect(
      entryView(entry({ reason: 'grant', delta: 10, event: null, comment: 'промо' })),
    ).toMatchObject({
      note: 'промо',
    })
    expect(entryView(entry({ event: null })).title).toBe('Событие удалено')
    expect(entryView(entry({ reason: 'refund', delta: 1, event: null })).title).toBe(
      'Возврат · событие отменено',
    )
  })

  it('does not expose the unit word credits for unknown future reasons', () => {
    const view = entryView(entry({ reason: 'something_new' as never, delta: 3, event: null }))
    expect(view.title).toBe('Операция с балансом')
    expect(JSON.stringify(view).toLowerCase()).not.toContain('credit')
  })
})
