import type { EventPricingView } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  bookingPaymentChip,
  playerEventLoadErrorNotice,
  playerEventPageState,
  playerEventReady,
  projectPlayerEvent,
} from './player-event'

const now = new Date('2026-09-24T10:00:00Z')
const event = {
  status: 'published',
  startsAt: '2026-09-25T18:00:00Z',
  cancellationDeadlineHours: 12,
  capacity: 10,
  taken: 4,
  price: 15,
  myBooking: null as { status: string } | null,
}
const access = { memberActive: true, subscriptionsEnabled: true, hasEligibleSubscription: true }

describe('player event view state', () => {
  it('keeps the booking rejection visible when a withdrawn event refresh returns 404', () => {
    expect(playerEventLoadErrorNotice(404, 'Запись на это событие закрыта')).toEqual({
      message: 'Запись на это событие закрыта. Событие больше недоступно.',
      retry: false,
      eventsLink: true,
    })
  })

  it('keeps Retry for a transient refresh failure', () => {
    expect(playerEventLoadErrorNotice(503, 'Эту запись нельзя отменить')).toEqual({
      message: 'Эту запись нельзя отменить',
      retry: true,
      eventsLink: false,
    })
  })

  it('shows pending or suspended access before the expected 403 event error', () => {
    const sources = {
      eventMatches: false,
      organizationMatches: true,
      eventPending: false,
      organizationPending: false,
      eventError: true,
      organizationError: false,
    }
    expect(playerEventPageState('pending', sources)).toBe('pending')
    expect(
      playerEventPageState(
        'suspended',
        {
          ...sources,
          organizationMatches: false,
          organizationError: true,
        },
        'organization.suspended',
      ),
    ).toBe('suspended')
  })

  it('keeps loading and unrelated failures distinct from access notices', () => {
    const sources = {
      eventMatches: true,
      organizationMatches: true,
      eventPending: false,
      organizationPending: false,
      eventError: false,
      organizationError: false,
    }
    expect(playerEventPageState('active', sources)).toBe('ready')
    expect(playerEventPageState('pending', { ...sources, organizationPending: true })).toBe(
      'loading',
    )
    expect(playerEventPageState('pending', { ...sources, organizationError: true })).toBe('error')
    expect(playerEventPageState('active', { ...sources, eventError: true })).toBe('error')
    expect(
      playerEventPageState(
        'suspended',
        { ...sources, organizationError: true },
        'network.unavailable',
      ),
    ).toBe('error')
  })

  it('renders denied access from a tenant permission error, not from an unrelated failure', () => {
    const sources = {
      eventMatches: false,
      organizationMatches: false,
      eventPending: false,
      organizationPending: false,
      eventError: true,
      organizationError: true,
    }
    expect(playerEventPageState('denied', sources, 'permission.blocked')).toBe('denied')
    expect(playerEventPageState('denied', sources, 'network.unavailable')).toBe('error')
  })

  it('keeps the payment axis separate from participation on booking chips', () => {
    expect(bookingPaymentChip('pending_payment')).toEqual({ tone: 'amber', text: 'Ждёт оплаты' })
    for (const status of ['confirmed', 'attended', 'waitlisted', 'cancelled', null])
      expect(bookingPaymentChip(status)).toBeNull()
  })
  it('blocks actions while current sources refresh or fail, despite retained matching data', () => {
    const current = {
      eventMatches: true,
      organizationMatches: true,
      eventPending: false,
      organizationPending: false,
      eventError: false,
      organizationError: false,
    }
    expect(playerEventReady(current)).toBe(true)
    expect(playerEventReady({ ...current, eventPending: true })).toBe(false)
    expect(playerEventReady({ ...current, organizationPending: true })).toBe(false)
    expect(playerEventReady({ ...current, eventError: true })).toBe(false)
    expect(playerEventReady({ ...current, organizationError: true })).toBe(false)
    expect(playerEventReady({ ...current, organizationMatches: false })).toBe(false)
  })

  it('uses booking for a published paid event and only real eligible methods', () => {
    expect(projectPlayerEvent(event, access, now)).toMatchObject({
      action: 'book',
      paymentMethods: ['cash', 'transfer', 'subscription'],
    })
    expect(
      projectPlayerEvent(event, { ...access, hasEligibleSubscription: false }, now).paymentMethods,
    ).toEqual(['cash', 'transfer'])
  })

  it('uses the waitlist action when actual capacity is full', () => {
    expect(projectPlayerEvent({ ...event, taken: 10 }, access, now).action).toBe('waitlist')
  })

  it('submits free directly and never offers paid choices', () => {
    expect(projectPlayerEvent({ ...event, price: 0 }, access, now).paymentMethods).toEqual(['free'])
  })

  it('hides subscription when disabled or unresolved', () => {
    expect(
      projectPlayerEvent(event, { ...access, subscriptionsEnabled: false }, now).paymentMethods,
    ).toEqual(['cash', 'transfer'])
    expect(
      projectPlayerEvent(event, { ...access, subscriptionsEnabled: null }, now).paymentMethods,
    ).toEqual(['cash', 'transfer'])
  })

  it('fails closed without active membership or for draft/cancelled/started events', () => {
    expect(projectPlayerEvent(event, { ...access, memberActive: false }, now).action).toBe('none')
    expect(projectPlayerEvent({ ...event, status: 'draft' }, access, now).action).toBe('none')
    expect(projectPlayerEvent({ ...event, status: 'cancelled' }, access, now).action).toBe('none')
    expect(
      projectPlayerEvent({ ...event, startsAt: '2026-09-24T09:59:59Z' }, access, now).action,
    ).toBe('none')
  })

  it.each(['pending_payment', 'confirmed', 'waitlisted', 'attended', 'no_show'])(
    'shows %s as an existing booking without a new booking action',
    (status) => {
      const view = projectPlayerEvent({ ...event, myBooking: { status } }, access, now)
      expect(view.bookingStatus).toBe(status)
      expect(view.action).toBe('none')
    },
  )

  it('permits rebooking after a cancelled record', () => {
    const view = projectPlayerEvent({ ...event, myBooking: { status: 'cancelled' } }, access, now)
    expect(view.action).toBe('book')
    expect(view.hasBooking).toBe(false)
    expect(view.bookingCard).toMatchObject({ title: 'Запись отменена' })
  })

  it('keeps deadline and started-event cancellation restrictions for all statuses', () => {
    expect(
      projectPlayerEvent({ ...event, myBooking: { status: 'confirmed' } }, access, now).canCancel,
    ).toBe(true)
    const afterDeadline = new Date('2026-09-25T07:00:01Z')
    expect(
      projectPlayerEvent({ ...event, myBooking: { status: 'confirmed' } }, access, afterDeadline)
        .canCancel,
    ).toBe(false)
    expect(
      projectPlayerEvent({ ...event, myBooking: { status: 'waitlisted' } }, access, afterDeadline)
        .canCancel,
    ).toBe(false)
    expect(
      projectPlayerEvent({ ...event, myBooking: { status: 'attended' } }, access, now).canCancel,
    ).toBe(false)
  })

  it('hides self-cancellation when the group policy snapshot forbids it (D-02)', () => {
    const mine = { ...event, myBooking: { status: 'confirmed' } }
    expect(projectPlayerEvent({ ...mine, cancellationAllowed: false }, access, now).canCancel).toBe(
      false,
    )
    expect(projectPlayerEvent({ ...mine, cancellationAllowed: true }, access, now).canCancel).toBe(
      true,
    )
  })

  it('exposes the cancellation deadline for «Отменить можно до …»', () => {
    const view = projectPlayerEvent({ ...event, myBooking: { status: 'confirmed' } }, access, now)
    expect(view.cancelDeadline?.toISOString()).toBe('2026-09-25T06:00:00.000Z')
    const open = projectPlayerEvent({ ...event, cancellationDeadlineHours: null }, access, now)
    expect(open.cancelDeadline).toBeNull()
  })

  it('locks only an allocated split booking after settlement', () => {
    const pricing: EventPricingView = {
      mode: 'split',
      targetAmount: 10000,
      settledAt: '2026-09-24T09:00:00Z',
      participantCount: 3,
      minAmount: 3333,
      maxAmount: 3334,
      basis: 'settled',
      myAllocatedAmount: null,
      myPaymentStatus: null,
    }
    expect(
      projectPlayerEvent(
        { ...event, price: 0, pricing, myBooking: { status: 'waitlisted' } },
        access,
        now,
      ).canCancel,
    ).toBe(true)
    expect(
      projectPlayerEvent(
        {
          ...event,
          price: 0,
          pricing: { ...pricing, myAllocatedAmount: 3334, myPaymentStatus: 'pending' },
          myBooking: { status: 'pending_payment' },
        },
        access,
        now,
      ).canCancel,
    ).toBe(false)
  })
})

describe('player event view state: seats, queue and booking opening (20.4.5)', () => {
  it('free seats come from the server and include seats held by waitlist offers', () => {
    // занято 4 из 10, но 6 мест удерживают предложения из очереди: свободных нет — очередь
    expect(projectPlayerEvent({ ...event, freeSeats: 0 }, access, now)).toMatchObject({
      freeSeats: 0,
      action: 'waitlist',
      paymentMethods: ['cash', 'transfer', 'subscription'],
    })
    expect(projectPlayerEvent({ ...event, freeSeats: 3 }, access, now)).toMatchObject({
      freeSeats: 3,
      action: 'book',
    })
  })

  it('falls back to capacity minus taken when the server sends no free seats', () => {
    expect(projectPlayerEvent(event, access, now).freeSeats).toBe(6)
    expect(projectPlayerEvent({ ...event, taken: 12 }, access, now).freeSeats).toBe(0)
  })

  it('does not offer booking before the booking opening time', () => {
    const opens = '2026-09-24T12:00:00Z'
    const view = projectPlayerEvent({ ...event, bookingOpensAt: opens }, access, now)
    expect(view).toMatchObject({ action: 'none', paymentMethods: [] })
    expect(view.opensAt?.toISOString()).toBe('2026-09-24T12:00:00.000Z')
    expect(
      projectPlayerEvent({ ...event, bookingOpensAt: '2026-09-24T09:00:00Z' }, access, now),
    ).toMatchObject({ action: 'book', opensAt: null })
  })

  it('titles a multi-seat booking «Вы записаны на N места»', () => {
    const view = projectPlayerEvent(
      { ...event, myBooking: { status: 'confirmed', seats: 2, waitlistSeats: 0 } },
      access,
      now,
    )
    expect(view.bookingCard).toMatchObject({ title: 'Вы записаны на 2 места' })
    expect(view.seatsNote).toBeNull()
  })

  it('explains a booking partly in the queue', () => {
    const view = projectPlayerEvent(
      { ...event, myBooking: { status: 'confirmed', seats: 1, waitlistSeats: 2 } },
      access,
      now,
    )
    expect(view.seatsNote).toBe('1 место за вами, ещё 2 места в очереди')
  })

  it('exposes the active waitlist offer of my booking', () => {
    const offer = { id: 7, seats: 2, expiresAt: '2026-09-24T10:20:00Z' }
    const view = projectPlayerEvent(
      { ...event, myBooking: { status: 'waitlisted', seats: 2, waitlistSeats: 0, offer } },
      access,
      now,
    )
    expect(view.offer).toEqual(offer)
    expect(projectPlayerEvent(event, access, now).offer).toBeNull()
  })
})

describe('time-reactive booking state (M3, review #156)', () => {
  const sched = { ...access, schedulerEnabled: true }
  // начало 2026-09-25T18:00Z, закрытие за 120 мин = 16:00Z
  const base = { ...event, closeBeforeMinutes: 120 }
  it('the server flag closes the booking; the close moment is only the next boundary', () => {
    const before = projectPlayerEvent(base, sched, new Date('2026-09-25T15:59:00Z'))
    expect(before).toMatchObject({ action: 'book', closedBySchedule: false })
    expect(before.nextBoundary?.toISOString()).toBe('2026-09-25T16:00:00.000Z')
    const closed = projectPlayerEvent(
      { ...base, bookingClosed: true },
      sched,
      new Date('2026-09-25T16:00:01Z'),
    )
    expect(closed).toMatchObject({ action: 'none', closedBySchedule: true, nextBoundary: null })
  })
  it('does not guess the closing from time: no server flag, still bookable (manual close mark)', () => {
    const late = new Date('2026-09-25T16:30:00Z')
    expect(projectPlayerEvent(base, sched, late).action).toBe('book')
    expect(projectPlayerEvent({ ...base, bookingClosed: false }, sched, late).action).toBe('book')
  })
  it('the opening moment is the next boundary', () => {
    const opening = { ...base, bookingOpensAt: '2026-09-24T12:00:00Z' }
    expect(projectPlayerEvent(opening, sched, now).nextBoundary?.toISOString()).toBe(
      '2026-09-24T12:00:00.000Z',
    )
    expect(projectPlayerEvent(opening, sched, new Date('2026-09-24T12:00:01Z')).action).toBe('book')
  })
})
