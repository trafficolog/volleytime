import { describe, expect, it } from 'vitest'

import { buildSearchSections, shouldSearch, type CabinetSearchResponse } from './cabinet-search'

const base: CabinetSearchResponse = {
  query: 'ол',
  searched: true,
  players: { items: [], more: false },
  events: { items: [], more: false },
  payments: null,
}

describe('cabinet search view model (20.5.2)', () => {
  it('searches from two characters', () => {
    expect(shouldSearch(' о ')).toBe(false)
    expect(shouldSearch('ол')).toBe(true)
  })

  it('builds sections in order, skipping empty types and the payments type without access', () => {
    const sections = buildSearchSections(
      30,
      {
        ...base,
        players: {
          more: true,
          items: [
            {
              memberId: 5,
              userId: 9,
              name: 'Ольга Волкова',
              telegramUsername: 'olga_v',
              image: null,
              role: 'player',
              status: 'active',
            },
          ],
        },
        events: {
          more: false,
          items: [
            {
              id: 71,
              title: 'Пятничная игра',
              startsAt: '2027-10-01T12:00:00.000Z',
              status: 'published',
              venueName: 'Зал Спартак',
            },
          ],
        },
      },
      'Europe/Minsk',
    )
    expect(sections.map((s) => s.key)).toEqual(['players', 'events'])
    expect(sections[0]).toMatchObject({ heading: 'Игроки', more: true })
    expect(sections[0]!.rows[0]).toMatchObject({
      to: '/app/orgs/30/members',
      title: 'Ольга Волкова',
      subtitle: '@olga_v · Игрок',
    })
    expect(sections[1]!.rows[0]).toMatchObject({
      to: '/app/orgs/30/events/71',
      title: 'Пятничная игра',
    })
    expect(sections[1]!.rows[0]!.subtitle).toContain('Зал Спартак')
    expect(sections[1]!.rows[0]!.subtitle).toContain('Открыто')
  })

  it('shows payments with purpose and status', () => {
    const [section] = buildSearchSections(
      30,
      {
        ...base,
        payments: {
          more: false,
          items: [
            {
              id: 3,
              status: 'pending',
              amount: 1500,
              currency: 'BYN',
              createdAt: '2027-10-01T12:00:00.000Z',
              user: { id: 9, name: 'Ольга', telegramUsername: null },
              event: null,
              planName: 'Золотой',
            },
          ],
        },
      },
      'Europe/Minsk',
    )
    expect(section).toMatchObject({ key: 'payments', heading: 'Платежи' })
    expect(section!.rows[0]!.to).toBe('/app/orgs/30/payments')
    expect(section!.rows[0]!.title).toContain('Ольга')
    expect(section!.rows[0]!.subtitle).toBe('Абонемент «Золотой» · Ожидает подтверждения')
  })
})
