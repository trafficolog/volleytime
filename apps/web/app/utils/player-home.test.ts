import { describe, expect, it } from 'vitest'

import type { EventListItem } from '../components/EventCard.vue'

import {
  awaitingPaymentLabel,
  playerAccessFromApiError,
  playerGreeting,
  playerHomeAccess,
  projectPlayerHome,
  sessionsTile,
} from './player-home'

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
  it('takes the server-chosen hero even when it is outside the schedule list, and keeps it out of the schedule', () => {
    const closed = {
      ...event(9, '2026-10-30T18:00:00Z', 'closed'),
      myBooking: { id: 5, status: 'confirmed' },
    }
    const view = projectPlayerHome([event(1, '2026-09-25T18:00:00Z')], now, closed)
    expect(view.hero?.id).toBe(9)
    expect(view.schedule.map((item) => item.id)).toEqual([1])
    const inList = event(1, '2026-09-25T18:00:00Z')
    const same = projectPlayerHome([inList, event(2, '2026-09-26T18:00:00Z')], now, inList)
    expect(same.schedule.map((item) => item.id)).toEqual([2])
  })

  it('drops a server hero that has already started and falls back to the list', () => {
    const started = {
      ...event(9, '2026-09-24T09:00:00Z'),
      myBooking: { id: 5, status: 'confirmed' },
    }
    const view = projectPlayerHome([event(1, '2026-09-25T18:00:00Z')], now, started)
    expect(view.hero?.id).toBe(1)
    expect(view.schedule).toEqual([])
  })

  it('prefers the nearest game the player is going to as hero (reference M-03)', () => {
    const going = { ...event(3, '2026-09-27T18:00:00Z'), myBooking: { id: 1, status: 'confirmed' } }
    const waiting = {
      ...event(1, '2026-09-25T18:00:00Z'),
      myBooking: { id: 2, status: 'waitlisted' },
    }
    const view = projectPlayerHome([going, event(2, '2026-09-26T18:00:00Z'), waiting], now)
    expect(view.hero?.id).toBe(3)
    expect(view.schedule.map((item) => item.id)).toEqual([1, 2])
  })

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
  it('classifies tenant access failures for direct Mini App routes without swallowing network errors', () => {
    expect(playerAccessFromApiError('forbidden.pending_approval')).toBe('pending')
    expect(playerAccessFromApiError('organization.suspended')).toBe('suspended')
    expect(playerAccessFromApiError('permission.blocked')).toBe('denied')
    expect(playerAccessFromApiError('permission.not_member')).toBe('denied')
    expect(playerAccessFromApiError('network.unavailable')).toBeNull()
    expect(playerAccessFromApiError(undefined)).toBeNull()
  })

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

  it.each(['permission.blocked', 'permission.not_member', 'permission.no_longer_member'])(
    'shows denied access for tenant error %s before group details can load',
    (code) => {
      expect(playerHomeAccess(3, null, null, code)).toBe('denied')
    },
  )
})

describe('player home bento tiles (20.4.4)', () => {
  it('greets by first name and omits the greeting without a name', () => {
    expect(playerGreeting('Артём Иванов')).toBe('Привет, Артём')
    expect(playerGreeting('  ')).toBeNull()
    expect(playerGreeting(null)).toBeNull()
  })

  it('shows the sessions tile when subscriptions are on or an active balance remains', () => {
    expect(sessionsTile(true, { left: 5, total: 8 })).toEqual({
      kind: 'balance',
      left: 5,
      total: 8,
    })
    expect(sessionsTile(true, null)).toEqual({ kind: 'none' })
    expect(sessionsTile(false, { left: 2, total: 8 })).toEqual({
      kind: 'balance',
      left: 2,
      total: 8,
    })
    expect(sessionsTile(false, null)).toBeNull()
  })

  it('words the awaiting-payment marker with agreement and hides it at zero', () => {
    expect(awaitingPaymentLabel(0)).toBeNull()
    expect(awaitingPaymentLabel(1)).toBe('1 ждёт оплаты')
    expect(awaitingPaymentLabel(2)).toBe('2 ждут оплаты')
    expect(awaitingPaymentLabel(21)).toBe('21 ждёт оплаты')
  })
})
