import { describe, expect, it } from 'vitest'

import { schedulerIntervalMs } from './scheduler-config'

describe('schedulerIntervalMs (20.3.1)', () => {
  it('defaults to 15 s and clamps to 1–60 s', () => {
    expect(schedulerIntervalMs(undefined)).toBe(15_000)
    expect(schedulerIntervalMs('')).toBe(15_000)
    expect(schedulerIntervalMs('abc')).toBe(15_000)
    expect(schedulerIntervalMs('-5')).toBe(15_000)
    expect(schedulerIntervalMs('10')).toBe(1_000)
    expect(schedulerIntervalMs('30000')).toBe(30_000)
    expect(schedulerIntervalMs('600000')).toBe(60_000)
  })
})
