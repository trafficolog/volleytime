import { describe, expect, it } from 'vitest'

import {
  EMPTY_SEAT_PAYMENTS,
  paidSeatsReleasedByRemoving,
  seatPaymentsFromRows,
  type SeatPaymentsView,
} from './seat-payments'

describe('seatPaymentsFromRows', () => {
  it('counts live pending and paid seats and released paid seats of the current incarnation', () => {
    expect(
      seatPaymentsFromRows([
        { status: 'succeeded', seatReleasedAt: null },
        { status: 'succeeded', seatReleasedAt: null },
        { status: 'pending', seatReleasedAt: null },
        { status: 'succeeded', seatReleasedAt: new Date() },
      ]),
    ).toEqual({ paidSeats: 2, pendingSeats: 1, releasedPaidSeats: 1 })
  })

  it('ignores cancelled and refunded payments and an empty list', () => {
    expect(
      seatPaymentsFromRows([
        { status: 'cancelled', seatReleasedAt: null },
        { status: 'refunded', seatReleasedAt: new Date() },
        { status: 'refunded', seatReleasedAt: null },
      ]),
    ).toEqual(EMPTY_SEAT_PAYMENTS)
    expect(seatPaymentsFromRows([])).toEqual(EMPTY_SEAT_PAYMENTS)
  })
})

describe('paidSeatsReleasedByRemoving', () => {
  const view = (paidSeats: number, pendingSeats: number): SeatPaymentsView => ({
    paidSeats,
    pendingSeats,
    releasedPaidSeats: 0,
  })
  const cash = (seats: number, waitlistSeats = 0) => ({
    status: 'confirmed',
    method: 'cash',
    seats,
    waitlistSeats,
  })

  it('releases paid seats when no unpaid seat is left to drop', () => {
    expect(paidSeatsReleasedByRemoving(1, cash(3), view(3, 0))).toBe(1)
    expect(paidSeatsReleasedByRemoving(3, cash(3), view(3, 0))).toBe(3)
  })

  it('drops unpaid seats first, so removing only them releases nothing', () => {
    expect(paidSeatsReleasedByRemoving(1, cash(3), view(2, 1))).toBe(0)
    expect(paidSeatsReleasedByRemoving(2, cash(3), view(2, 1))).toBe(1)
  })

  it('drops queued seats before the main seats', () => {
    expect(paidSeatsReleasedByRemoving(1, cash(2, 1), view(2, 0))).toBe(0)
    expect(paidSeatsReleasedByRemoving(2, cash(2, 1), view(2, 0))).toBe(1)
  })

  it('returns subscription sessions before paid seats', () => {
    const sub = { status: 'confirmed', method: 'subscription', seats: 3, waitlistSeats: 0 }
    // 2 места на занятиях абонемента + 1 оплачено наличными (продвижение из очереди)
    expect(paidSeatsReleasedByRemoving(2, sub, view(1, 0))).toBe(0)
    expect(paidSeatsReleasedByRemoving(3, sub, view(1, 0))).toBe(1)
  })

  it('releases nothing for a waitlisted booking or an unpaid one', () => {
    const waiting = { status: 'waitlisted', method: 'cash', seats: 0, waitlistSeats: 2 }
    expect(paidSeatsReleasedByRemoving(1, waiting, EMPTY_SEAT_PAYMENTS)).toBe(0)
    expect(paidSeatsReleasedByRemoving(1, cash(2), EMPTY_SEAT_PAYMENTS)).toBe(0)
  })
})
