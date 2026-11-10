import { describe, expect, it } from 'vitest'

import { overviewPeriods, safeTimezone } from './periods'

const iso = (d: Date) => d.toISOString()

describe('overviewPeriods', () => {
  it('builds Monday-based weeks ending with the current one in the group zone', () => {
    // среда 2026-11-04 12:00 UTC, Минск UTC+3
    const { month, weeks } = overviewPeriods(new Date('2026-11-04T12:00:00Z'), 'Europe/Minsk')
    expect(iso(month.from)).toBe('2026-10-31T21:00:00.000Z')
    expect(iso(month.to)).toBe('2026-11-30T21:00:00.000Z')
    expect(weeks.map((w) => iso(w.from))).toEqual([
      '2026-10-11T21:00:00.000Z',
      '2026-10-18T21:00:00.000Z',
      '2026-10-25T21:00:00.000Z',
      '2026-11-01T21:00:00.000Z',
    ])
    expect(iso(weeks[3]!.to)).toBe('2026-11-08T21:00:00.000Z')
    // недели смежные: конец одной = начало следующей
    for (let i = 0; i < 3; i++) expect(weeks[i]!.to.getTime()).toBe(weeks[i + 1]!.from.getTime())
  })

  it('switches week exactly at local Monday midnight, not at UTC midnight', () => {
    // воскресенье 23:59:59 по Минску ещё прежняя неделя
    const sunday = overviewPeriods(new Date('2026-11-01T20:59:59Z'), 'Europe/Minsk')
    expect(iso(sunday.weeks[3]!.from)).toBe('2026-10-25T21:00:00.000Z')
    // понедельник 00:00:00 по Минску — уже новая
    const monday = overviewPeriods(new Date('2026-11-01T21:00:00Z'), 'Europe/Minsk')
    expect(iso(monday.weeks[3]!.from)).toBe('2026-11-01T21:00:00.000Z')
  })

  it('switches month at local midnight of the first day', () => {
    // 2026-05-31 21:30 UTC = 1 июня 00:30 в Минске
    const june = overviewPeriods(new Date('2026-05-31T21:30:00Z'), 'Europe/Minsk')
    expect(iso(june.month.from)).toBe('2026-05-31T21:00:00.000Z')
    expect(iso(june.month.to)).toBe('2026-06-30T21:00:00.000Z')
    // за минуту до полуночи — ещё май
    const may = overviewPeriods(new Date('2026-05-31T20:59:00Z'), 'Europe/Minsk')
    expect(iso(may.month.from)).toBe('2026-04-30T21:00:00.000Z')
    expect(iso(may.month.to)).toBe('2026-05-31T21:00:00.000Z')
  })

  it('uses the group zone even when UTC is on another calendar day', () => {
    // 2026-12-31 22:00 UTC = 1 января 2027 в Минске
    const { month } = overviewPeriods(new Date('2026-12-31T22:00:00Z'), 'Europe/Minsk')
    expect(iso(month.from)).toBe('2026-12-31T21:00:00.000Z')
    expect(iso(month.to)).toBe('2027-01-31T21:00:00.000Z')
  })

  it('handles daylight saving transitions inside a week', () => {
    // Нью-Йорк, переход на летнее время 2026-03-08: неделя 2–9 марта на час короче
    const { weeks } = overviewPeriods(new Date('2026-03-10T15:00:00Z'), 'America/New_York')
    const current = weeks[3]!
    expect(iso(current.from)).toBe('2026-03-09T04:00:00.000Z') // пн 00:00 EDT (UTC−4)
    const previous = weeks[2]!
    expect(iso(previous.from)).toBe('2026-03-02T05:00:00.000Z') // пн 00:00 EST (UTC−5)
    expect(previous.to.getTime() - previous.from.getTime()).toBe(167 * 3600_000)
  })

  it('falls back to the default zone for an unknown timezone', () => {
    expect(safeTimezone('Nowhere/Land')).toBe('Europe/Minsk')
    expect(safeTimezone('')).toBe('Europe/Minsk')
    expect(safeTimezone(null)).toBe('Europe/Minsk')
    expect(safeTimezone('Europe/Warsaw')).toBe('Europe/Warsaw')
    const a = overviewPeriods(new Date('2026-11-04T12:00:00Z'), 'Nowhere/Land')
    const b = overviewPeriods(new Date('2026-11-04T12:00:00Z'), 'Europe/Minsk')
    expect(a).toEqual(b)
  })

  it('gives the previous calendar month and the 7-day expiry window (21.4.4)', () => {
    const { month, previousMonth, expiryWindow } = overviewPeriods(
      new Date('2026-11-04T12:00:00Z'),
      'Europe/Minsk',
    )
    expect(iso(previousMonth.from)).toBe('2026-09-30T21:00:00.000Z')
    expect(iso(previousMonth.to)).toBe('2026-10-31T21:00:00.000Z')
    expect(previousMonth.to.getTime()).toBe(month.from.getTime())
    expect(iso(expiryWindow.from)).toBe('2026-11-04T12:00:00.000Z')
    expect(iso(expiryWindow.to)).toBe('2026-11-11T12:00:00.000Z')
  })

  it('wraps the previous month over a year edge', () => {
    const { previousMonth } = overviewPeriods(new Date('2027-01-10T10:00:00Z'), 'Europe/Minsk')
    expect(iso(previousMonth.from)).toBe('2026-11-30T21:00:00.000Z')
    expect(iso(previousMonth.to)).toBe('2026-12-31T21:00:00.000Z')
  })
})
