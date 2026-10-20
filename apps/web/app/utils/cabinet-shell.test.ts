import { describe, expect, it } from 'vitest'

import { cabinetNavIcon, cabinetNavSections, eventBalanceCard } from './cabinet-shell'

describe('cabinet sidebar sections (20.5.3)', () => {
  it('groups the cabinet routes into Организация and Платформа', () => {
    const sections = cabinetNavSections(7, true)
    expect(sections.map((s) => s.heading)).toEqual(['Организация', 'Платформа'])
    expect(sections[0]!.items.map((i) => i.key)).toEqual([
      'overview',
      'events',
      'members',
      'plans',
      'payments',
      'cashbox',
    ])
    expect(sections[1]!.items.map((i) => i.key)).toEqual(['settings'])
    expect(sections[1]!.items[0]!.to).toBe('/app/orgs/7/settings')
  })

  it('hides Абонементы when subscriptions are off and never links to pages that do not exist yet', () => {
    const keys = cabinetNavSections(7, false).flatMap((s) => s.items.map((i) => i.key))
    expect(keys).not.toContain('plans')
    expect(keys).not.toContain('contributions')
    expect(keys).not.toContain('reports')
    expect(keys).not.toContain('billing')
  })

  it('gives every nav item an icon', () => {
    for (const item of cabinetNavSections(7, true).flatMap((s) => s.items)) {
      expect(cabinetNavIcon(item.key)).toMatch(/^[a-z-]+$/)
    }
  })
})

describe('event balance card (20.5.3, D-10)', () => {
  it('shows the remaining events with the right plural', () => {
    expect(eventBalanceCard({ balance: 32, low: false })).toEqual({
      value: '32',
      caption: 'события в балансе',
      low: false,
    })
    expect(eventBalanceCard({ balance: 48, low: false }).caption).toBe('событий в балансе')
    expect(eventBalanceCard({ balance: 1, low: true }).caption).toBe('событие в балансе')
    expect(eventBalanceCard({ balance: 2, low: true }).caption).toBe('события в балансе')
    expect(eventBalanceCard({ balance: 21, low: false }).caption).toBe('событие в балансе')
    expect(eventBalanceCard({ balance: 11, low: false }).caption).toBe('событий в балансе')
    expect(eventBalanceCard({ balance: 0, low: true }).low).toBe(true)
  })

  it('falls back to a dash while the balance is not loaded', () => {
    expect(eventBalanceCard(null)).toEqual({ value: '—', caption: 'баланс событий', low: false })
  })
})
