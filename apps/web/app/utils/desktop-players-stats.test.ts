import type { PlayerStats } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  activityView,
  debtView,
  playerStatsPeriodLabel,
  subscriptionView,
} from './desktop-players-stats'

const stats = (patch: Partial<PlayerStats> = {}): PlayerStats => ({
  attendance: { visits: 0, noShows: 0, cancellations: 0, ratePercent: null, lastVisitAt: null },
  subscription: null,
  debt: { amount: 0, seats: 0, currency: 'BYN' },
  ...patch,
})

describe('activityView', () => {
  it('shows visits and the last visit date in the group zone', () => {
    const view = activityView(
      stats({
        attendance: {
          visits: 24,
          noShows: 2,
          cancellations: 1,
          ratePercent: 92,
          lastVisitAt: '2026-04-30T21:30:00.000Z', // 1 мая 00:30 по Минску
        },
      }),
      'Europe/Minsk',
    )
    expect(view.visits).toBe('24 тр.')
    expect(view.last).toBe('посл. 01.05.2026')
    expect(view.lastDate).toBe('01.05.2026')
    expect(view.rate).toBe('92%')
  })

  it('shows dashes when the player has no visits in the period', () => {
    expect(activityView(stats(), 'Europe/Minsk')).toEqual({
      visits: '0 тр.',
      last: 'нет визитов',
      lastDate: '—',
      rate: '—',
    })
  })

  it('declines "тр." only as an abbreviation, whatever the count', () => {
    for (const n of [1, 2, 5, 11, 21])
      expect(
        activityView(
          stats({
            attendance: {
              visits: n,
              noShows: 0,
              cancellations: 0,
              ratePercent: 100,
              lastVisitAt: null,
            },
          }),
          'UTC',
        ).visits,
      ).toBe(`${n} тр.`)
  })
})

describe('subscriptionView', () => {
  it('shows remaining / total and the expiry', () => {
    expect(
      subscriptionView(
        stats({
          subscription: {
            remaining: 5,
            total: 8,
            expiresAt: '2026-06-30T00:00:00.000Z',
            count: 1,
          },
        }),
        'Europe/Minsk',
      ),
    ).toEqual({ label: '5 / 8', hint: 'до 30.06.2026' })
  })

  it('shows an unlimited term and none at all as a dash', () => {
    expect(
      subscriptionView(
        stats({ subscription: { remaining: 1, total: 4, expiresAt: null, count: 1 } }),
        'UTC',
      ),
    ).toEqual({ label: '1 / 4', hint: 'бессрочно' })
    expect(subscriptionView(stats(), 'UTC')).toBeNull()
  })

  it('mentions how many subscriptions are summed', () => {
    expect(
      subscriptionView(
        stats({ subscription: { remaining: 9, total: 16, expiresAt: null, count: 2 } }),
        'UTC',
      )!.hint,
    ).toBe('бессрочно · абонементов: 2')
  })
})

describe('debtView', () => {
  it('formats the amount in the group currency and the seat count', () => {
    expect(debtView(stats({ debt: { amount: 3700, seats: 3, currency: 'BYN' } }))).toEqual({
      label: '37.00 BYN',
      hint: '3 места',
    })
    expect(debtView(stats({ debt: { amount: 1500, seats: 1, currency: 'BYN' } }))!.hint).toBe(
      '1 место',
    )
    expect(debtView(stats({ debt: { amount: 500, seats: 5, currency: 'BYN' } }))!.hint).toBe(
      '5 мест',
    )
  })

  it('shows no debt as null', () => {
    expect(debtView(stats())).toBeNull()
  })
})

describe('playerStatsPeriodLabel', () => {
  it('names the attendance window with local dates', () => {
    expect(playerStatsPeriodLabel({ from: '2026-02-20', to: '2026-05-20' })).toBe(
      'за период 20.02.2026 — 20.05.2026',
    )
  })
})
