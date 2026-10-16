import { describe, expect, it } from 'vitest'

import { fullRosterForecast } from './event-form-price'

describe('fullRosterForecast (D-01 B: цена из quoteEventPrice)', () => {
  it('splits the target to the kopeck over the full roster', () => {
    // 180,00 на 14 мест: 12,85 или 12,86 — доли отличаются на копейку
    expect(fullRosterForecast(18000, 14)).toEqual({ min: 1285, max: 1286 })
    expect(fullRosterForecast(18000, 12)).toEqual({ min: 1500, max: 1500 })
  })

  it('keeps the shares within one kopeck and their sum equal to the target', () => {
    for (const [target, capacity] of [
      [1, 500],
      [18000, 14],
      [99999, 7],
      [2147483647, 3],
    ] as const) {
      const { min, max } = fullRosterForecast(target, capacity)
      expect(min).toBe(Math.floor(target / capacity))
      expect(max - min).toBeLessThanOrEqual(1)
      expect(min * capacity).toBeLessThanOrEqual(target)
      expect(max * capacity).toBeGreaterThanOrEqual(target)
    }
  })
})
