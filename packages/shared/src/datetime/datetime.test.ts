import { describe, expect, it } from 'vitest'

import { dateToZonedInput, formatEventDate, formatTime, zonedInputToDate } from './datetime'

describe('datetime in organization timezone (5.13.16)', () => {
  const utc16 = new Date('2026-09-18T16:00:00Z')

  it('formats in org timezone regardless of process TZ', () => {
    expect(formatTime(utc16, 'Europe/Minsk')).toBe('19:00')
    expect(formatTime(utc16, 'Asia/Almaty')).toBe('21:00')
    expect(formatEventDate(utc16, 'Europe/Minsk')).toContain('18 сентября')
  })

  it('round-trips datetime-local input', () => {
    expect(zonedInputToDate('2026-09-18T19:00', 'Europe/Minsk').toISOString()).toBe(
      '2026-09-18T16:00:00.000Z',
    )
    expect(dateToZonedInput(utc16, 'Europe/Minsk')).toBe('2026-09-18T19:00')
  })

  it('handles DST zones', () => {
    // Берлин: летнее время UTC+2 до 25.10.2026
    expect(zonedInputToDate('2026-10-20T19:00', 'Europe/Berlin').toISOString()).toBe(
      '2026-10-20T17:00:00.000Z',
    )
    expect(zonedInputToDate('2026-11-20T19:00', 'Europe/Berlin').toISOString()).toBe(
      '2026-11-20T18:00:00.000Z',
    )
  })
})
