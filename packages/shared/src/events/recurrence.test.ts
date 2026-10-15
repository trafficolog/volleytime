import { describe, expect, it } from 'vitest'

import {
  expandSeriesRule,
  isoWeekday,
  RecurrenceError,
  SERIES_MAX_DATES,
  seriesOccurrence,
} from './recurrence'

const reason = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e instanceof RecurrenceError ? e.reason : `unexpected: ${String(e)}`
  }
  return 'no error'
}

describe('series recurrence (20.2.2)', () => {
  it('ISO weekday: Monday = 1 … Sunday = 7', () => {
    expect(isoWeekday('2026-10-12')).toBe(1)
    expect(isoWeekday('2026-10-18')).toBe(7)
  })

  it('once: a single date, weekdays ignored', () => {
    expect(expandSeriesRule({ freq: 'once', weekdays: [], startDate: '2026-11-03' }).dates).toEqual(
      ['2026-11-03'],
    )
  })

  it('weekly by weekdays until a date, both bounds inclusive, start need not match a weekday', () => {
    const { dates } = expandSeriesRule({
      freq: 'weekly',
      weekdays: [1, 3],
      startDate: '2026-11-03', // вторник
      until: '2026-11-16', // понедельник
    })
    expect(dates).toEqual(['2026-11-04', '2026-11-09', '2026-11-11', '2026-11-16'])
  })

  it('weekly with count: N occurrences', () => {
    const { dates } = expandSeriesRule({
      freq: 'weekly',
      weekdays: [5],
      startDate: '2026-11-01',
      count: 3,
    })
    expect(dates).toEqual(['2026-11-06', '2026-11-13', '2026-11-20'])
  })

  it('biweekly counts weeks from the week of startDate (Monday-based)', () => {
    const { dates } = expandSeriesRule({
      freq: 'biweekly',
      weekdays: [2, 7],
      startDate: '2026-11-04', // среда: вторник этой недели уже прошёл
      count: 4,
    })
    expect(dates).toEqual(['2026-11-08', '2026-11-17', '2026-11-22', '2026-12-01'])
  })

  it('exceptions remove generated dates (count counts occurrences before exceptions)', () => {
    const r = expandSeriesRule(
      { freq: 'weekly', weekdays: [3], startDate: '2026-12-01', count: 4 },
      ['2026-12-23', '2026-12-30', '2027-05-05'],
    )
    expect(r.dates).toEqual(['2026-12-02', '2026-12-09', '2026-12-16'])
    // исключение вне серии ни на что не влияет и не возвращается как исключённое
    // 30.12 — пятое повторение, за пределами count = 4
    expect(r.excluded).toEqual(['2026-12-23'])
  })

  it('a year of Mondays and Wednesdays is 104 dates; daily for a leap year fits the limit', () => {
    expect(
      expandSeriesRule({
        freq: 'weekly',
        weekdays: [1, 3],
        startDate: '2027-01-01',
        until: '2027-12-31',
      }).dates,
    ).toHaveLength(104)
    expect(
      expandSeriesRule({
        freq: 'weekly',
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        startDate: '2028-01-01',
        until: '2028-12-31', // високосный год: 366 дат
      }).dates,
    ).toHaveLength(SERIES_MAX_DATES)
  })

  it('more than 366 dates → too_many_dates, even with a far-away until', () => {
    expect(
      reason(() =>
        expandSeriesRule({
          freq: 'weekly',
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          startDate: '2027-01-01',
          until: '2028-01-02',
        }),
      ),
    ).toBe('too_many_dates')
    expect(
      reason(() =>
        expandSeriesRule({
          freq: 'weekly',
          weekdays: [1],
          startDate: '2027-01-01',
          until: '9999-12-31',
        }),
      ),
    ).toBe('too_many_dates')
  })

  it.each([
    [
      'weekly without weekdays',
      { freq: 'weekly', weekdays: [], startDate: '2027-01-01', count: 2 },
    ],
    ['weekday out of range', { freq: 'weekly', weekdays: [0], startDate: '2027-01-01', count: 2 }],
    ['duplicate weekday', { freq: 'weekly', weekdays: [1, 1], startDate: '2027-01-01', count: 2 }],
    ['neither until nor count', { freq: 'weekly', weekdays: [1], startDate: '2027-01-01' }],
    [
      'both until and count',
      { freq: 'weekly', weekdays: [1], startDate: '2027-01-01', until: '2027-02-01', count: 2 },
    ],
    [
      'until before start',
      { freq: 'weekly', weekdays: [1], startDate: '2027-01-10', until: '2027-01-01' },
    ],
    [
      'once with until',
      { freq: 'once', weekdays: [], startDate: '2027-01-01', until: '2027-01-02' },
    ],
    ['invalid calendar date', { freq: 'once', weekdays: [], startDate: '2027-02-30' }],
    ['count zero', { freq: 'weekly', weekdays: [1], startDate: '2027-01-01', count: 0 }],
  ] as const)('%s → invalid_rule', (_label, rule) => {
    expect(reason(() => expandSeriesRule(rule as never))).toBe('invalid_rule')
  })

  it('all dates excluded → invalid_rule (a series has at least one date)', () => {
    expect(
      reason(() =>
        expandSeriesRule({ freq: 'once', weekdays: [], startDate: '2027-01-01' }, ['2027-01-01']),
      ),
    ).toBe('invalid_rule')
  })

  it('occurrence keeps the local wall time across DST in the group timezone', () => {
    // Europe/Berlin: 29.03.2026 переход на летнее время (UTC+1 → UTC+2)
    const before = seriesOccurrence('2026-03-25', '19:00', 90, 'Europe/Berlin')
    const after = seriesOccurrence('2026-04-01', '19:00', 90, 'Europe/Berlin')
    expect(before.startsAt.toISOString()).toBe('2026-03-25T18:00:00.000Z')
    expect(after.startsAt.toISOString()).toBe('2026-04-01T17:00:00.000Z')
    expect(after.endsAt.getTime() - after.startsAt.getTime()).toBe(90 * 60_000)
    // осенний переход (25.10.2026, UTC+2 → UTC+1)
    expect(
      seriesOccurrence('2026-10-28', '19:00', 60, 'Europe/Berlin').startsAt.toISOString(),
    ).toBe('2026-10-28T18:00:00.000Z')
    // группа по умолчанию (Минск, без перехода)
    expect(seriesOccurrence('2026-11-04', '19:00', 60, 'Europe/Minsk').startsAt.toISOString()).toBe(
      '2026-11-04T16:00:00.000Z',
    )
  })
})
