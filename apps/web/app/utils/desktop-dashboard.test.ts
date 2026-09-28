import { describe, expect, it } from 'vitest'

import { desktopDashboardView } from './desktop-dashboard'

const event = {
  id: 9,
  title: 'Тренировка',
  status: 'published',
  startsAt: '2026-09-29T16:00:00Z',
  endsAt: '2026-09-29T18:00:00Z',
  capacity: 12,
  price: 2500,
  currency: 'BYN',
  taken: 4,
  waitlist: 0,
  myBooking: null,
  venue: { name: 'Зал' },
  locationText: null,
}

describe('desktop dashboard projection', () => {
  it('does not invent manager metrics when the dashboard is absent', () => {
    expect(desktopDashboardView(null)).toBeNull()
  })

  it('preserves server amounts, currency, count and upcoming event without trend fields', () => {
    const view = desktopDashboardView({
      isManager: true,
      upcoming: [event],
      manager: {
        pendingCount: 2,
        pendingAmount: 2500,
        balance: { currency: 'BYN', balance: -1250 },
      },
    })

    expect(view).toEqual({
      balance: { currency: 'BYN', balance: -1250 },
      pendingCount: 2,
      pendingAmount: 2500,
      upcoming: [event],
    })
    expect(view).not.toHaveProperty('trend')
  })

  it('does not expose manager amounts from a player response', () => {
    expect(desktopDashboardView({ isManager: false, manager: null, upcoming: [event] })).toBeNull()
  })
})
