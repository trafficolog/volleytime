import { describe, expect, it } from 'vitest'

import type { EventListItem } from '../components/EventCard.vue'

import { playerHomeAccess, projectPlayerHome } from './player-home'

const now = new Date('2026-09-24T10:00:00Z')

function event(id: number, startsAt: string, status = 'published'): EventListItem {
  return {
    id,
    title: `Тренировка ${id}`,
    status,
    startsAt,
    endsAt: '2026-09-25T20:00:00Z',
    capacity: 14,
    price: 15,
    currency: 'BYN',
    taken: id,
    waitlist: 0,
    myBooking: null,
    venue: { name: 'Зал' },
    locationText: null,
  }
}

describe('player home event projection', () => {
  it('uses the nearest published future event as hero and sorts the rest', () => {
    const later = event(3, '2026-09-27T18:00:00Z')
    const nearer = event(2, '2026-09-25T18:00:00Z')
    const view = projectPlayerHome(
      [
        event(1, '2026-09-23T18:00:00Z'),
        later,
        event(4, '2026-09-25T17:00:00Z', 'draft'),
        nearer,
        event(5, '2026-09-26T18:00:00Z', 'cancelled'),
      ],
      now,
    )

    expect(view.hero?.id).toBe(2)
    expect(view.hero?.taken).toBe(2)
    expect(view.hero?.capacity).toBe(14)
    expect(view.schedule.map((item) => item.id)).toEqual([3])
  })

  it('has no mock fallback when no upcoming published event exists', () => {
    expect(projectPlayerHome([], now)).toEqual({ hero: null, schedule: [] })
    expect(projectPlayerHome([event(1, '2026-09-23T18:00:00Z')], now)).toEqual({
      hero: null,
      schedule: [],
    })
  })
})

describe('player home membership gate', () => {
  it('fails closed for missing or old-group membership', () => {
    expect(playerHomeAccess(2, { id: 1, status: 'active' }, { status: 'active' })).toBe('loading')
    expect(playerHomeAccess(2, { id: 2, status: 'active' }, null)).toBe('denied')
    expect(playerHomeAccess(2, { id: 2, status: 'active' }, { status: 'blocked' })).toBe('denied')
  })

  it('keeps pending and suspended groups informational', () => {
    expect(playerHomeAccess(2, { id: 2, status: 'active' }, { status: 'pending' })).toBe('pending')
    expect(playerHomeAccess(2, { id: 2, status: 'suspended' }, { status: 'active' })).toBe(
      'suspended',
    )
  })

  it('recognizes the tenant suspended error before organization details can load', () => {
    expect(playerHomeAccess(3, null, null, 'organization.suspended')).toBe('suspended')
    expect(playerHomeAccess(3, null, null, 'organization.archived')).toBe('loading')
  })
})
