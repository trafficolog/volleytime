import { describe, expect, it } from 'vitest'

import { allocateSplitAmount, previewSplitAmount } from './pricing'

const at = new Date('2026-10-01T10:00:00Z')
const fixtures = [
  { bookingId: 3, bookedAt: new Date('2026-10-01T10:02:00Z') },
  { bookingId: 1, bookedAt: at },
  { bookingId: 2, bookedAt: new Date('2026-10-01T10:01:00Z') },
]

describe('split cents', () => {
  it('allocates_remainder_by_bookedAt_then_id without mutating input', () => {
    expect(allocateSplitAmount(10000, fixtures)).toEqual([
      { bookingId: 1, amount: 3334 },
      { bookingId: 2, amount: 3333 },
      { bookingId: 3, amount: 3333 },
    ])
    expect(fixtures.map((p) => p.bookingId)).toEqual([3, 1, 2])
  })

  it('breaks equal-time ties by booking ID', () => {
    expect(
      allocateSplitAmount(5, [
        { bookingId: 2, bookedAt: at },
        { bookingId: 1, bookedAt: at },
      ]),
    ).toEqual([
      { bookingId: 1, amount: 3 },
      { bookingId: 2, amount: 2 },
    ])
  })

  it('allocates exact division without a rounding gap', () => {
    expect(allocateSplitAmount(9, fixtures)).toEqual([
      { bookingId: 1, amount: 3 },
      { bookingId: 2, amount: 3 },
      { bookingId: 3, amount: 3 },
    ])
  })

  it('handles one participant and PostgreSQL maximum integer', () => {
    expect(allocateSplitAmount(2147483647, [{ bookingId: 1, bookedAt: at }])).toEqual([
      { bookingId: 1, amount: 2147483647 },
    ])
    expect(allocateSplitAmount(2147483647, fixtures)).toEqual([
      { bookingId: 1, amount: 715827883 },
      { bookingId: 2, amount: 715827882 },
      { bookingId: 3, amount: 715827882 },
    ])
  })

  it('preserves exact sum and a maximum one-cent gap for 500 participants', () => {
    const shares = allocateSplitAmount(
      10001,
      Array.from({ length: 500 }, (_, i) => ({ bookingId: i + 1, bookedAt: at })),
    )
    expect(shares[0]).toEqual({ bookingId: 1, amount: 21 })
    expect(shares[499]).toEqual({ bookingId: 500, amount: 20 })
    expect(shares.reduce((sum, p) => sum + p.amount, 0)).toBe(10001)
    expect(
      Math.max(...shares.map((p) => p.amount)) - Math.min(...shares.map((p) => p.amount)),
    ).toBe(1)
  })

  it('rejects empty participants and targets below participant count', () => {
    expect(() => allocateSplitAmount(100, [])).toThrow()
    expect(() => allocateSplitAmount(2, fixtures)).toThrow()
  })

  it.each([0, -1, 1.5, 2147483648, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid target %s',
    (total) => {
      expect(() => allocateSplitAmount(total, fixtures)).toThrow()
      expect(() => previewSplitAmount(total, 1, 4)).toThrow()
    },
  )

  it('previews empty current roster using capacity', () => {
    expect(previewSplitAmount(10000, 0, 4)).toEqual({
      minAmount: 2500,
      maxAmount: 2500,
      participantCount: 4,
      basis: 'capacity',
    })
  })

  it('previews current roster with one-cent range', () => {
    expect(previewSplitAmount(10000, 3, 4)).toEqual({
      minAmount: 3333,
      maxAmount: 3334,
      participantCount: 3,
      basis: 'current',
    })
  })

  it('keeps low-target previews provisional even when final allocation would be rejected', () => {
    expect(previewSplitAmount(1, 0, 4)).toEqual({
      minAmount: 0,
      maxAmount: 1,
      participantCount: 4,
      basis: 'capacity',
    })
    expect(previewSplitAmount(1, 3, 4)).toEqual({
      minAmount: 0,
      maxAmount: 1,
      participantCount: 3,
      basis: 'current',
    })
    expect(() => allocateSplitAmount(1, fixtures)).toThrow()
  })

  it.each([
    [0, 0],
    [-1, 4],
    [1.5, 4],
    [5, 4],
    [0, 501],
  ])('rejects invalid taken/capacity %s/%s', (taken, capacity) => {
    expect(() => previewSplitAmount(10000, taken, capacity)).toThrow()
  })
})
