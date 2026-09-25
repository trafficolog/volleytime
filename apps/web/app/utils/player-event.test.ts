import { describe, expect, it } from 'vitest'

import { eventCardBookingState, playerEventReady, projectPlayerEvent } from './player-event'

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
  it('labels a cancelled event-card booking neutrally while leaving no active booking chip for null', () => {
    expect(eventCardBookingState('cancelled')).toEqual({ tone: 'default', text: 'Запись отменена' })
    expect(eventCardBookingState(null)).toBeNull()
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
})
