import { describe, expect, it } from 'vitest'

import { quoteEventPrice } from './price-quote'
import { allocateSplitAmount } from './pricing'

const split = (overrides: Partial<Parameters<typeof quoteSplit>[0]> = {}) => quoteSplit(overrides)
function quoteSplit(
  o: {
    targetAmount?: number
    capacity?: number
    takenSeats?: number
    mySeats?: number
    seats?: number
    settled?: { participantCount: number; myAllocatedAmount: number | null } | null
  } = {},
) {
  return quoteEventPrice({
    mode: 'split',
    targetAmount: o.targetAmount ?? 10000,
    capacity: o.capacity ?? 4,
    takenSeats: o.takenSeats ?? 0,
    mySeats: o.mySeats ?? 0,
    seats: o.seats ?? 1,
    settled: o.settled ?? null,
  })
}

describe('quoteEventPrice — fixed (20.1.1)', () => {
  it('multiplies the seat price by the player seats, exact range', () => {
    expect(
      quoteEventPrice({ mode: 'fixed', price: 1500, seats: 3, subscriptionsEnabled: true }),
    ).toEqual({
      mode: 'fixed',
      basis: 'fixed',
      seats: 3,
      perSeat: { min: 1500, max: 1500 },
      total: { min: 4500, max: 4500 },
      seatCount: null,
      targetAmount: null,
      subscriptionApplicable: true,
    })
  })

  it('offers no subscription for a free event or when the group disabled subscriptions', () => {
    expect(
      quoteEventPrice({ mode: 'fixed', price: 0, seats: 1, subscriptionsEnabled: true }),
    ).toMatchObject({ total: { min: 0, max: 0 }, subscriptionApplicable: false })
    expect(
      quoteEventPrice({ mode: 'fixed', price: 1500, seats: 1, subscriptionsEnabled: false }),
    ).toMatchObject({ subscriptionApplicable: false })
  })

  it('keeps the maximum PostgreSQL price times ten seats an exact safe integer', () => {
    const quote = quoteEventPrice({
      mode: 'fixed',
      price: 2147483647,
      seats: 10,
      subscriptionsEnabled: true,
    })
    expect(quote.total).toEqual({ min: 21474836470, max: 21474836470 })
    expect(Number.isSafeInteger(quote.total.max)).toBe(true)
  })

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid seats %s', (seats) => {
    expect(() =>
      quoteEventPrice({ mode: 'fixed', price: 1500, seats, subscriptionsEnabled: true }),
    ).toThrow(RangeError)
  })

  it.each([-1, 1.5, 2147483648])('rejects invalid price %s', (price) => {
    expect(() =>
      quoteEventPrice({ mode: 'fixed', price, seats: 1, subscriptionsEnabled: true }),
    ).toThrow(RangeError)
  })
})

describe('quoteEventPrice — split forecast before closing (20.1.1)', () => {
  it('0 booked: range from the full roster to the requesting player alone', () => {
    expect(split({ takenSeats: 0, seats: 1 })).toEqual({
      mode: 'split',
      basis: 'forecast',
      seats: 1,
      perSeat: { min: 2500, max: 10000 },
      total: { min: 2500, max: 10000 },
      seatCount: { current: 1, max: 4 },
      targetAmount: 10000,
      subscriptionApplicable: false,
    })
  })

  it('1 booked (the caller): from capacity share to the whole target', () => {
    expect(split({ takenSeats: 1, mySeats: 1, seats: 1 })).toMatchObject({
      perSeat: { min: 2500, max: 10000 },
      seatCount: { current: 1, max: 4 },
    })
  })

  it('current roster of 3 of 4 rounds the upper bound up by the one-cent remainder', () => {
    expect(split({ takenSeats: 3, mySeats: 1, seats: 1 })).toMatchObject({
      perSeat: { min: 2500, max: 3334 },
      total: { min: 2500, max: 3334 },
      seatCount: { current: 3, max: 4 },
    })
  })

  it('max booked: both ends collapse to the capacity share', () => {
    expect(split({ takenSeats: 4, mySeats: 1, seats: 1 })).toMatchObject({
      perSeat: { min: 2500, max: 2500 },
      total: { min: 2500, max: 2500 },
      seatCount: { current: 4, max: 4 },
    })
  })

  it('several seats for one player: requested seats join the current roster', () => {
    // 2 others booked + 3 of mine = 5 of 12; target 18000
    expect(
      split({ targetAmount: 18000, capacity: 12, takenSeats: 2, mySeats: 0, seats: 3 }),
    ).toMatchObject({
      seats: 3,
      perSeat: { min: 1500, max: 3600 },
      total: { min: 4500, max: 10800 },
      seatCount: { current: 5, max: 12 },
    })
  })

  it('several seats with a remainder: the total upper bound adds at most one cent per seat', () => {
    // 10001 over 3 seats: q=3333 r=2 → 2 seats take at most 3333*2+2
    expect(split({ targetAmount: 10001, capacity: 5, takenSeats: 1, seats: 2 })).toMatchObject({
      perSeat: { min: 2000, max: 3334 },
      total: { min: 4000, max: 6668 },
      seatCount: { current: 3, max: 5 },
    })
  })

  it('a booked player changing their seat count replaces, not adds, their seats', () => {
    expect(split({ takenSeats: 3, mySeats: 1, seats: 2 })).toMatchObject({
      seatCount: { current: 4, max: 4 },
      perSeat: { min: 2500, max: 2500 },
      total: { min: 5000, max: 5000 },
    })
  })

  it('caps the current roster at capacity when the requested seats would overflow it', () => {
    expect(split({ takenSeats: 4, mySeats: 0, seats: 2 })).toMatchObject({
      seatCount: { current: 4, max: 4 },
      total: { min: 5000, max: 5000 },
    })
  })

  it('last-minute cancellation before closing recalculates the forecast upwards', () => {
    const before = split({ targetAmount: 10001, capacity: 4, takenSeats: 4, mySeats: 1 })
    const after = split({ targetAmount: 10001, capacity: 4, takenSeats: 3, mySeats: 1 })
    expect(before.perSeat).toEqual({ min: 2500, max: 2501 })
    expect(after.perSeat).toEqual({ min: 2500, max: 3334 })
  })

  it('never applies a subscription to a split event', () => {
    expect(split().subscriptionApplicable).toBe(false)
  })

  it.each([
    { capacity: 0 },
    { capacity: 501 },
    { takenSeats: -1 },
    { takenSeats: 5 },
    { mySeats: 2, takenSeats: 1 },
    { seats: 0 },
    { seats: 5 },
    { targetAmount: 0 },
    { targetAmount: 2147483648 },
  ])('rejects invalid input %o', (o) => {
    expect(() => split(o)).toThrow(RangeError)
  })
})

describe('quoteEventPrice — split settled at closing (20.1.1, D-01)', () => {
  it('returns the fixed own share exactly once the price is settled', () => {
    expect(
      split({
        targetAmount: 10001,
        takenSeats: 3,
        mySeats: 1,
        settled: { participantCount: 3, myAllocatedAmount: 3334 },
      }),
    ).toEqual({
      mode: 'split',
      basis: 'settled',
      seats: 1,
      perSeat: { min: 3334, max: 3334 },
      total: { min: 3334, max: 3334 },
      seatCount: { current: 3, max: 3 },
      targetAmount: 10001,
      subscriptionApplicable: false,
    })
  })

  it('ignores later cancellations: the settled count, not the live roster, drives the range', () => {
    const settled = { participantCount: 3, myAllocatedAmount: null }
    expect(split({ targetAmount: 10001, takenSeats: 1, settled })).toMatchObject({
      perSeat: { min: 3333, max: 3334 },
      seatCount: { current: 3, max: 3 },
    })
  })

  it('uses the rounding range for a non-participant or a different seat count', () => {
    const settled = { participantCount: 3, myAllocatedAmount: 3334 }
    expect(
      split({ targetAmount: 10001, takenSeats: 3, mySeats: 1, seats: 2, settled }),
    ).toMatchObject({ total: { min: 6666, max: 6668 } })
  })

  it.each([
    [10000, 1],
    [10001, 3],
    [1, 1],
    [999, 7],
    [2147483647, 500],
  ])(
    'every booking share of target %s over %s seats falls inside the settled quote',
    (target, units) => {
      const bookedAt = new Date('2026-10-14T10:00:00Z')
      const shares = allocateSplitAmount(
        target,
        Array.from({ length: units }, (_, i) => ({ bookingId: i + 1, bookedAt })),
      )
      expect(shares.reduce((sum, s) => sum + s.amount, 0)).toBe(target)
      const quote = split({
        targetAmount: target,
        capacity: Math.max(units, 1),
        takenSeats: units,
        mySeats: 1,
        settled: { participantCount: units, myAllocatedAmount: null },
      })
      for (const s of shares) {
        expect(s.amount).toBeGreaterThanOrEqual(quote.total.min)
        expect(s.amount).toBeLessThanOrEqual(quote.total.max)
      }
    },
  )
})

describe('allocateSplitAmount by seats (20.1.1, D-01)', () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 14, 10, minute))

  it('one seat per booking keeps the R0.7 allocation bit-for-bit', () => {
    const people = [
      { bookingId: 3, bookedAt: at(2) },
      { bookingId: 1, bookedAt: at(0) },
      { bookingId: 2, bookedAt: at(1) },
    ]
    expect(allocateSplitAmount(10000, people)).toEqual(
      allocateSplitAmount(
        10000,
        people.map((p) => ({ ...p, seats: 1 })),
      ),
    )
  })

  it('splits by seat units in booking order and sums each booking units', () => {
    // 10001 over 5 units: q=2000, r=1 → first unit (booking 1) takes the extra cent
    expect(
      allocateSplitAmount(10001, [
        { bookingId: 2, bookedAt: at(1), seats: 3 },
        { bookingId: 1, bookedAt: at(0), seats: 2 },
      ]),
    ).toEqual([
      { bookingId: 1, amount: 4001 },
      { bookingId: 2, amount: 6000 },
    ])
  })

  it('remainder cents spill across a multi-seat booking boundary', () => {
    // 11 over 4 units: q=2 r=3 → units 1..3 get 3; booking 1 (1 seat)=3, booking 2 (3 seats)=3+3+2
    expect(
      allocateSplitAmount(11, [
        { bookingId: 1, bookedAt: at(0), seats: 1 },
        { bookingId: 2, bookedAt: at(1), seats: 3 },
      ]),
    ).toEqual([
      { bookingId: 1, amount: 3 },
      { bookingId: 2, amount: 8 },
    ])
  })

  it('sum of shares equals the target to the cent for many seat mixes', () => {
    for (const target of [7, 100, 10001, 99999, 2147483647])
      for (const seatMix of [[1], [3, 1, 2], [10, 10, 10], [2, 2, 2, 2, 1]]) {
        const units = seatMix.reduce((a, b) => a + b, 0)
        if (target < units) continue
        const shares = allocateSplitAmount(
          target,
          seatMix.map((seats, i) => ({ bookingId: i + 1, bookedAt: at(i), seats })),
        )
        expect(shares.reduce((s, x) => s + x.amount, 0)).toBe(target)
      }
  })

  it('rejects a target below the number of seat units and invalid seats', () => {
    expect(() => allocateSplitAmount(2, [{ bookingId: 1, bookedAt: at(0), seats: 3 }])).toThrow(
      RangeError,
    )
    for (const seats of [0, -1, 1.5])
      expect(() => allocateSplitAmount(100, [{ bookingId: 1, bookedAt: at(0), seats }])).toThrow(
        RangeError,
      )
  })
})
