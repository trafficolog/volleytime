import { describe, expect, it } from 'vitest'

import { DeliveryError, deliveryErrorFromStatus } from './delivery-error'
import { minutesOfDay, quietHoursEnd } from './quiet-hours'

// Europe/Minsk — UTC+3 без перехода на летнее время
const TZ = 'Europe/Minsk'
const at = (iso: string) => new Date(iso)

describe('quietHoursEnd', () => {
  const night = { start: 22 * 60, end: 7 * 60 }

  it('reads the clock in the group timezone', () => {
    expect(minutesOfDay(at('2026-10-20T19:30:00Z'), TZ)).toBe(22 * 60 + 30)
    expect(minutesOfDay(at('2026-10-20T21:00:00Z'), TZ)).toBe(0) // полночь, не «24:00»
  })

  it('returns null outside the window and when it is not set', () => {
    expect(quietHoursEnd(at('2026-10-20T10:00:00Z'), night, TZ)).toBeNull() // 13:00
    expect(quietHoursEnd(at('2026-10-20T10:00:00Z'), { start: null, end: null }, TZ)).toBeNull()
    expect(quietHoursEnd(at('2026-10-20T10:00:00Z'), { start: 60, end: 60 }, TZ)).toBeNull()
  })

  it('wraps over midnight: both sides of 00:00 end at the next 07:00', () => {
    // 23:30 по Минску -> 07:00 следующих суток
    expect(quietHoursEnd(at('2026-10-20T20:30:00Z'), night, TZ)?.toISOString()).toBe(
      '2026-10-21T04:00:00.000Z',
    )
    // 02:15 по Минску -> 07:00 того же дня
    expect(quietHoursEnd(at('2026-10-20T23:15:00Z'), night, TZ)?.toISOString()).toBe(
      '2026-10-21T04:00:00.000Z',
    )
  })

  it('treats the start as inside and the end as outside', () => {
    expect(quietHoursEnd(at('2026-10-20T19:00:00Z'), night, TZ)).not.toBeNull() // 22:00
    expect(quietHoursEnd(at('2026-10-21T04:00:00Z'), night, TZ)).toBeNull() // 07:00
  })

  it('supports a same-day window and drops seconds', () => {
    const lunch = { start: 12 * 60, end: 14 * 60 }
    expect(quietHoursEnd(at('2026-10-20T09:20:45Z'), lunch, TZ)?.toISOString()).toBe(
      '2026-10-20T11:00:00.000Z',
    )
  })

  it('ends at 07:00 wall-clock time across daylight-saving changes', () => {
    const NY = 'America/New_York'
    // 31.10 23:30 EDT (UTC-4) -> 01.11 03:30Z; в ночь на 1.11 часы переводят назад, 07:00 уже EST (UTC-5)
    expect(quietHoursEnd(at('2026-11-01T03:30:00Z'), night, NY)?.toISOString()).toBe(
      '2026-11-01T12:00:00.000Z',
    )
    // 7.03 23:30 EST (UTC-5) -> 08.03 04:30Z; в ночь на 8.03 часы переводят вперёд, 07:00 уже EDT (UTC-4)
    expect(quietHoursEnd(at('2026-03-08T04:30:00Z'), night, NY)?.toISOString()).toBe(
      '2026-03-08T11:00:00.000Z',
    )
    // без перехода результат тот же, что и раньше
    expect(quietHoursEnd(at('2026-07-01T03:30:00Z'), night, NY)?.toISOString()).toBe(
      '2026-07-01T11:00:00.000Z',
    )
  })

  it('never returns a moment before now when the window ends in the skipped spring hour', () => {
    const NY = 'America/New_York'
    const skipped = { start: 22 * 60, end: 2 * 60 + 30 } // 02:30 в ночь на 8.03 не существует
    // 01:50 EST (06:50Z): без защиты поправка дала бы 06:30Z, то есть прошлое
    const got = quietHoursEnd(at('2026-03-08T06:50:00Z'), skipped, NY)
    expect(got?.toISOString()).toBe('2026-03-08T07:30:00.000Z')
    expect(got!.getTime()).toBeGreaterThan(at('2026-03-08T06:50:00Z').getTime())
  })

  it('falls back to the default timezone for an unknown zone name', () => {
    expect(quietHoursEnd(at('2026-10-20T20:30:00Z'), night, 'Mars/Olympus')).not.toBeNull()
  })
})

describe('deliveryErrorFromStatus', () => {
  it('maps bot responses to delivery error kinds', () => {
    expect(deliveryErrorFromStatus(410)).toBeInstanceOf(DeliveryError)
    expect(deliveryErrorFromStatus(410).kind).toBe('blocked')
    expect(deliveryErrorFromStatus(500).kind).toBe('transient')
    expect(deliveryErrorFromStatus(undefined).kind).toBe('transient')
    const limited = deliveryErrorFromStatus(429, 7)
    expect(limited.kind).toBe('rate_limited')
    expect(limited.retryAfterMs).toBe(7000)
  })

  it('carries only a known group-chat failure reason on 410 (20.3.4)', () => {
    expect(deliveryErrorFromStatus(410, undefined, 'no_rights').reason).toBe('no_rights')
    expect(deliveryErrorFromStatus(410, undefined, 'migrated').reason).toBe('migrated')
    expect(deliveryErrorFromStatus(410, undefined, 'bot_removed').reason).toBe('bot_removed')
    expect(deliveryErrorFromStatus(410, undefined, 'something else').reason).toBeUndefined()
    expect(deliveryErrorFromStatus(410).reason).toBeUndefined()
    expect(deliveryErrorFromStatus(500, undefined, 'no_rights').reason).toBeUndefined()
  })

  it('bounds retry-after and defaults it when missing', () => {
    expect(deliveryErrorFromStatus(429).retryAfterMs).toBe(30_000)
    expect(deliveryErrorFromStatus(429, 0).retryAfterMs).toBe(1000)
    expect(deliveryErrorFromStatus(429, 86_400).retryAfterMs).toBe(600_000)
    expect(deliveryErrorFromStatus(429, Number.NaN).retryAfterMs).toBe(30_000)
  })
})
