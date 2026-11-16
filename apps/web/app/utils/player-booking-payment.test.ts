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
    // attended и no_show без долга (оплачены): seatPayments не ждёт оплаты
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

describe('canPayBooking (21.4.19): debtors of a held booking', () => {
  const debt = { pendingSeats: 1 }
  const paid = { pendingSeats: 0 }

  it('shows for an attended or no_show booking with an unpaid seat', () => {
    for (const status of ['attended', 'no_show']) {
      for (const method of ['cash', 'transfer']) {
        expect(canPayBooking(booking({ status, method, seatPayments: debt }))).toBe(true)
      }
    }
  })

  it('does not show for a held booking that is paid or has no payment data', () => {
    for (const status of ['attended', 'no_show']) {
      expect(canPayBooking(booking({ status, seatPayments: paid }))).toBe(false)
      expect(canPayBooking(booking({ status }))).toBe(false)
    }
  })

  it('does not turn a debt on other statuses into a button', () => {
    for (const status of ['confirmed', 'cancelled', 'waitlisted']) {
      expect(canPayBooking(booking({ status, seatPayments: debt }))).toBe(false)
    }
  })

  it('does not show for a held debtor of a cancelled event', () => {
    expect(
      canPayBooking(
        booking({ status: 'attended', seatPayments: debt, event: { status: 'cancelled' } }),
      ),
    ).toBe(false)
  })

  it('does not show for a held subscription or online booking, or unallocated split', () => {
    for (const method of ['subscription', 'online']) {
      expect(canPayBooking(booking({ status: 'no_show', method, seatPayments: debt }))).toBe(false)
    }
    expect(
      canPayBooking(
        booking({
          status: 'attended',
          seatPayments: debt,
          pricing: { mode: 'split', myAllocatedAmount: null },
        }),
      ),
    ).toBe(false)
  })
})

describe('payBookingPath', () => {
  it('points to the payment screen of the booking inside the group', () => {
    expect(payBookingPath(30, 5)).toBe('/m/orgs/30/pay/5')
  })
})
