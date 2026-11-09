import type { PlayerStats } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import { MINIAPP_FETCH_STATUSES, MINIAPP_PLAYER_TABS, playersSummary } from './miniapp-players'

import type { MemberRow } from '~/composables/useOrganizations'

const noStats: PlayerStats = {
  attendance: { visits: 0, noShows: 0, cancellations: 0, ratePercent: null, lastVisitAt: null },
  subscription: null,
  debt: { amount: 0, seats: 0, currency: 'BYN' },
}

function member(
  id: number,
  status: MemberRow['status'],
  stats: Partial<PlayerStats> | null = {},
): MemberRow {
  return {
    id,
    organizationId: 1,
    role: 'player',
    status,
    level: null,
    joinedAt: null,
    createdAt: '2026-05-01T00:00:00Z',
    user: { id: id + 100, name: `Игрок ${id}`, telegramUsername: null, image: null },
    ...(stats === null ? {} : { stats: { ...noStats, ...stats } }),
  }
}

const sub = { remaining: 3, total: 8, expiresAt: null, count: 1 }

describe('Mini App players tabs', () => {
  it('offers active, requests and all, in the reference order', () => {
    expect(MINIAPP_PLAYER_TABS.map((t) => t.label)).toEqual(['Активные', 'Заявки', 'Все'])
  })

  it('fetches left and rejected too, so the cabinet counts and filters stay identical', () => {
    expect(MINIAPP_FETCH_STATUSES).toEqual([
      'active',
      'pending',
      'guest',
      'blocked',
      'left',
      'rejected',
    ])
  })
})

describe('Mini App players summary', () => {
  it('counts active players with a subscription and with a debt from the API stats', () => {
    const summary = playersSummary([
      member(1, 'active', { subscription: sub }),
      member(2, 'active', { debt: { amount: 1500, seats: 1, currency: 'BYN' } }),
      member(3, 'active', {
        subscription: sub,
        debt: { amount: 0, seats: 2, currency: 'BYN' },
      }),
      member(4, 'active'),
    ])
    expect(summary).toEqual({ active: 4, withSubscription: 2, withDebt: 2 })
  })

  it('ignores members who are not active (excluded/left, pending, guest, blocked)', () => {
    const summary = playersSummary([
      member(1, 'active', { subscription: sub }),
      member(2, 'left', { subscription: sub, debt: { amount: 900, seats: 1, currency: 'BYN' } }),
      member(3, 'pending', { subscription: sub }),
      member(4, 'guest', { debt: { amount: 900, seats: 1, currency: 'BYN' } }),
      member(5, 'blocked', { subscription: sub }),
    ])
    expect(summary).toEqual({ active: 1, withSubscription: 1, withDebt: 0 })
  })

  it('has no subscription or debt tiles when the API sent no stats', () => {
    expect(playersSummary([member(1, 'active', null), member(2, 'active', null)])).toEqual({
      active: 2,
      withSubscription: null,
      withDebt: null,
    })
  })
})
