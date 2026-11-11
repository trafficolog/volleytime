import { describe, expect, it } from 'vitest'

import { canPayBooking, payBookingPath } from './player-booking-payment'

const booking = (over: Record<string, unknown> = {}) => ({
  status: 'pending_payment',
  method: 'transfer',
  event: { status: 'published' },
  pricing: { mode: 'fixed' },
  ...over,
})

describe('canPayBooking (21.4.8): the «Оплатить» button', () => {
  it('shows for a booking that waits for a cash or transfer payment', () => {
    expect(canPayBooking(booking())).toBe(true)
    expect(canPayBooking(booking({ method: 'cash' }))).toBe(true)
  })

  it('does not show for paid, confirmed, attended, cancelled or waitlisted bookings', () => {
    for (const status of ['confirmed', 'attended', 'no_show', 'cancelled', 'waitlisted']) {
      expect(canPayBooking(booking({ status }))).toBe(false)
    }
  })

  it('does not show for subscription or online bookings: nothing to pay by hand', () => {
    expect(canPayBooking(booking({ method: 'subscription' }))).toBe(false)
    expect(canPayBooking(booking({ method: 'online' }))).toBe(false)
  })

  it('does not show for a cancelled event', () => {
    expect(canPayBooking(booking({ event: { status: 'cancelled' } }))).toBe(false)
  })

  it('does not show for split pricing until the amount is allocated', () => {
    expect(canPayBooking(booking({ pricing: { mode: 'split', myAllocatedAmount: null } }))).toBe(
      false,
    )
    expect(canPayBooking(booking({ pricing: { mode: 'split', myAllocatedAmount: 700 } }))).toBe(
      true,
    )
  })
})

describe('payBookingPath', () => {
  it('points to the payment screen of the booking inside the group', () => {
    expect(payBookingPath(30, 5)).toBe('/m/orgs/30/pay/5')
  })
})
