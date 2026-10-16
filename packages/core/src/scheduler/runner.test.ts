import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isSchedulerEnabled } from './capability'
import { backoffMs, MAX_ATTEMPTS } from './journal'
import { createSchedulerRunner } from './runner'

describe('scheduler runner (20.3.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs ticks on the interval without overlapping and survives tick errors', async () => {
    let active = 0
    let maxActive = 0
    let calls = 0
    const errors: unknown[] = []
    const runner = createSchedulerRunner({
      intervalMs: 1000,
      onError: (e) => errors.push(e),
      tick: async () => {
        calls++
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise((r) => setTimeout(r, 2500))
        active--
        if (calls === 1) throw new Error('db down')
      },
    })
    runner.start()
    await vi.advanceTimersByTimeAsync(999)
    expect(calls).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toBe(1)
    // проход длится 2.5 с: следующий — через интервал после окончания, не параллельно
    await vi.advanceTimersByTimeAsync(3000)
    expect(calls).toBe(1)
    await vi.advanceTimersByTimeAsync(600)
    expect(calls).toBe(2)
    expect(maxActive).toBe(1)
    expect(errors).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2500)
    await runner.stop()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toBe(2)
  })

  it('stop waits for the running tick (graceful shutdown)', async () => {
    let finished = false
    const runner = createSchedulerRunner({
      intervalMs: 10,
      tick: async () => {
        await new Promise((r) => setTimeout(r, 100))
        finished = true
      },
    })
    runner.start()
    await vi.advanceTimersByTimeAsync(10)
    const stopping = runner.stop()
    expect(finished).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    await stopping
    expect(finished).toBe(true)
  })

  it('backoff grows exponentially and is capped; the flag needs the exact value', () => {
    expect([1, 2, 3, 4, 5].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000, 480_000])
    expect(backoffMs(20)).toBe(30 * 60_000)
    expect(MAX_ATTEMPTS).toBe(6)
    expect(isSchedulerEnabled('true')).toBe(true)
    for (const v of [undefined, '', '1', 'TRUE', 'yes']) expect(isSchedulerEnabled(v)).toBe(false)
  })
})
