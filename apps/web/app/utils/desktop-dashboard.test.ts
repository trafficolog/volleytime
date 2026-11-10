import type { ManagerOverview } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  desktopDashboardView,
  formatOccupancy,
  overviewCashChart,
  overviewDeltaLabels,
  pendingPaymentMeta,
  pendingPaymentTitle,
} from './desktop-dashboard'

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

const overview: ManagerOverview = {
  timezone: 'Europe/Minsk',
  currency: 'BYN',
  month: { from: '2026-11-01T00:00:00Z', to: '2026-12-01T00:00:00Z' },
  events: { thisMonth: 12 },
  bookings: { count: 168, seats: 150, capacity: 180, occupancyPercent: 83 },
  subscriptions: { active: 9 },
  pendingPayments: {
    count: 1,
    amount: 2500,
    currency: 'BYN',
    items: [
      {
        id: 7,
        amount: 2500,
        currency: 'BYN',
        seats: 1,
        createdAt: '2026-11-04T10:00:00Z',
        user: { id: 3, name: 'Иван', telegramUsername: 'ivan' },
        event: { id: 9, title: 'Тренировка', startsAt: '2026-11-08T16:00:00Z' },
        plan: null,
        collection: null,
      },
    ],
  },
  deltas: {
    previousMonth: { from: '2026-09-30T21:00:00.000Z', to: '2026-10-31T21:00:00.000Z' },
    eventsVsPreviousMonth: 3,
    subscriptionsExpiringSoon: 2,
    cashWeekNet: 8250,
  },
  cashWeekly: {
    currency: 'BYN',
    weeks: [
      { from: '2026-10-12T21:00:00Z', to: '2026-10-19T21:00:00Z', income: 0, expense: 0, net: 0 },
      {
        from: '2026-10-19T21:00:00Z',
        to: '2026-10-26T21:00:00Z',
        income: 5000,
        expense: 1000,
        net: 4000,
      },
      {
        from: '2026-10-26T21:00:00Z',
        to: '2026-11-02T21:00:00Z',
        income: 2000,
        expense: 6000,
        net: -4000,
      },
      {
        from: '2026-11-02T21:00:00Z',
        to: '2026-11-09T21:00:00Z',
        income: 8250,
        expense: 0,
        net: 8250,
      },
    ],
    total: { income: 15250, expense: 7000, net: 8250 },
  },
}

describe('desktop dashboard projection', () => {
  it('does not invent manager metrics when the dashboard is absent', () => {
    expect(desktopDashboardView(null)).toBeNull()
  })

  it('keeps the balance block and passes the overview through without trend fields', () => {
    const view = desktopDashboardView({
      isManager: true,
      upcoming: [event],
      manager: {
        pendingCount: 2,
        pendingAmount: 2500,
        balance: { currency: 'BYN', balance: -1250 },
      },
      overview,
    })

    expect(view).toEqual({
      balance: { currency: 'BYN', balance: -1250 },
      upcoming: [event],
      overview,
    })
    expect(view).not.toHaveProperty('trend')
  })

  it('returns no view when the manager response has no overview', () => {
    expect(
      desktopDashboardView({
        isManager: true,
        upcoming: [event],
        manager: { pendingCount: 0, pendingAmount: 0, balance: { currency: 'BYN', balance: 0 } },
      }),
    ).toBeNull()
  })

  it('does not expose manager amounts from a player response', () => {
    expect(desktopDashboardView({ isManager: false, manager: null, upcoming: [event] })).toBeNull()
  })
})

describe('overview formatting', () => {
  it('shows occupancy exactly as the API gives it, or a dash when it is null', () => {
    expect(formatOccupancy(83)).toBe('83%')
    expect(formatOccupancy(0)).toBe('0%')
    expect(formatOccupancy(null)).toBe('—')
  })

  it('builds the pending payment title from the name, then the handle, then a fallback', () => {
    expect(pendingPaymentTitle(overview.pendingPayments.items[0]!)).toBe('Иван')
    const noName = {
      ...overview.pendingPayments.items[0]!,
      user: { id: 3, name: null, telegramUsername: 'ivan' },
    }
    expect(pendingPaymentTitle(noName)).toBe('@ivan')
    const anonymous = { ...noName, user: { id: 3, name: null, telegramUsername: null } }
    expect(pendingPaymentTitle(anonymous)).toBe('Игрок')
  })

  it('describes the payment by event and seat count', () => {
    const [item] = overview.pendingPayments.items
    expect(pendingPaymentMeta(item!)).toBe('Тренировка')
    expect(pendingPaymentMeta({ ...item!, seats: 3 })).toBe('Тренировка · 3 места')
    expect(
      pendingPaymentMeta({ ...item!, event: null, collection: { id: 1, title: 'Сбор' } }),
    ).toBe('Сбор')
  })

  it('takes the chart headline and bars from net, marks the last week as current', () => {
    const chart = overviewCashChart(overview.cashWeekly)

    expect(chart.headline).toBe('+82,50 BYN')
    expect(chart.bars.map((bar) => bar.value)).toEqual([
      '0,00 BYN',
      '+40,00 BYN',
      '-40,00 BYN',
      '+82,50 BYN',
    ])
    expect(chart.bars.map((bar) => bar.heightPercent)).toEqual([0, 48, 48, 100])
    expect(chart.bars.map((bar) => bar.current)).toEqual([false, false, false, true])
  })

  it('draws empty bars when every week is zero', () => {
    const chart = overviewCashChart({
      currency: 'BYN',
      weeks: overview.cashWeekly.weeks.map((w) => ({ ...w, income: 0, expense: 0, net: 0 })),
      total: { income: 0, expense: 0, net: 0 },
    })
    expect(chart.bars.every((bar) => bar.heightPercent === 0)).toBe(true)
  })
})

describe('overviewDeltaLabels (21.4.4, W-02)', () => {
  it('builds the three captions of the mockup', () => {
    expect(overviewDeltaLabels(overview)).toEqual({
      events: '+3 к октябрю',
      subscriptions: '2 истекают на неделе',
      cash: '+82,50 BYN на неделе',
    })
  })

  it('names the previous month in the group zone, not in UTC', () => {
    const jan = {
      ...overview,
      deltas: {
        ...overview.deltas,
        previousMonth: { from: '2026-12-31T21:00:00.000Z', to: '2027-01-31T21:00:00.000Z' },
      },
    }
    expect(overviewDeltaLabels(jan).events).toBe('+3 к январю')
  })

  it('shows negative and zero event deltas, hides it without a previous month', () => {
    const d = (eventsVsPreviousMonth: number | null) => ({
      ...overview,
      deltas: { ...overview.deltas, eventsVsPreviousMonth },
    })
    expect(overviewDeltaLabels(d(-2)).events).toBe('-2 к октябрю')
    expect(overviewDeltaLabels(d(0)).events).toBe('0 к октябрю')
    expect(overviewDeltaLabels(d(null)).events).toBeNull()
  })

  it('agrees the expiring caption in number and hides it at zero', () => {
    const d = (subscriptionsExpiringSoon: number) => ({
      ...overview,
      deltas: { ...overview.deltas, subscriptionsExpiringSoon },
    })
    expect(overviewDeltaLabels(d(1)).subscriptions).toBe('1 истекает на неделе')
    expect(overviewDeltaLabels(d(5)).subscriptions).toBe('5 истекают на неделе')
    expect(overviewDeltaLabels(d(21)).subscriptions).toBe('21 истекает на неделе')
    expect(overviewDeltaLabels(d(0)).subscriptions).toBeNull()
  })

  it('signs the cash delta: refunds can make the week negative, zero has no sign', () => {
    const d = (cashWeekNet: number) => ({
      ...overview,
      deltas: { ...overview.deltas, cashWeekNet },
    })
    expect(overviewDeltaLabels(d(-4000)).cash).toBe('-40,00 BYN на неделе')
    expect(overviewDeltaLabels(d(0)).cash).toBe('0,00 BYN на неделе')
  })
})
