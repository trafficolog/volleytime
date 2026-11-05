import { describe, expect, it } from 'vitest'

import {
  previousReportDates,
  reportBuckets,
  reportGranularity,
  reportPeriodPresets,
  resolveReportPeriod,
} from './periods'

const iso = (d: Date) => d.toISOString()
const MINSK = 'Europe/Minsk'

describe('resolveReportPeriod', () => {
  it('turns inclusive local dates into a half-open range in the group zone', () => {
    const p = resolveReportPeriod('2026-05-01', '2026-05-31', MINSK)!
    expect(iso(p.from)).toBe('2026-04-30T21:00:00.000Z')
    expect(iso(p.to)).toBe('2026-05-31T21:00:00.000Z')
  })

  it('uses the group zone, not UTC, for the boundaries', () => {
    const ny = resolveReportPeriod('2026-05-01', '2026-05-01', 'America/New_York')!
    expect(iso(ny.from)).toBe('2026-05-01T04:00:00.000Z')
    expect(iso(ny.to)).toBe('2026-05-02T04:00:00.000Z')
  })

  it('rejects malformed, inverted, impossible and oversized periods', () => {
    expect(resolveReportPeriod('2026-5-1', '2026-05-31', MINSK)).toBeNull()
    expect(resolveReportPeriod('2026-05-31', '2026-05-01', MINSK)).toBeNull()
    expect(resolveReportPeriod('2026-02-30', '2026-03-01', MINSK)).toBeNull()
    expect(resolveReportPeriod('2026-01-01', '2027-01-02', MINSK)).toBeNull()
    expect(resolveReportPeriod('2026-01-01', '2026-12-31', MINSK)).not.toBeNull()
  })
})

describe('previousReportDates', () => {
  it('shifts the same number of days back, adjacent to the period', () => {
    expect(previousReportDates('2026-05-01', '2026-05-31')).toEqual({
      from: '2026-03-31',
      to: '2026-04-30',
    })
    expect(previousReportDates('2026-03-01', '2026-03-01')).toEqual({
      from: '2026-02-28',
      to: '2026-02-28',
    })
  })
})

describe('reportPeriodPresets', () => {
  it('lists this month, previous month, quarter and year in the group zone', () => {
    // 2026-05-31 22:00 UTC уже 1 июня в Минске
    const presets = reportPeriodPresets(new Date('2026-05-31T22:00:00Z'), MINSK)
    expect(presets.map((p) => [p.key, p.label, p.from, p.to])).toEqual([
      ['month', 'Июнь 2026', '2026-06-01', '2026-06-30'],
      ['prev-month', 'Май 2026', '2026-05-01', '2026-05-31'],
      ['quarter', 'Q2 2026', '2026-04-01', '2026-06-30'],
      ['year', 'Год', '2026-01-01', '2026-12-31'],
    ])
  })

  it('wraps the previous month over New Year', () => {
    const presets = reportPeriodPresets(new Date('2026-01-10T12:00:00Z'), MINSK)
    expect(presets[1]).toMatchObject({
      label: 'Декабрь 2025',
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })
})

describe('reportBuckets', () => {
  it('splits a month into Monday weeks clipped to the period edges', () => {
    const buckets = reportBuckets('2026-05-01', '2026-05-31', MINSK)
    expect(buckets.map((b) => [b.fromDate, b.toDate])).toEqual([
      ['2026-05-01', '2026-05-03'],
      ['2026-05-04', '2026-05-10'],
      ['2026-05-11', '2026-05-17'],
      ['2026-05-18', '2026-05-24'],
      ['2026-05-25', '2026-05-31'],
    ])
    expect(iso(buckets[0]!.from)).toBe('2026-04-30T21:00:00.000Z')
    expect(iso(buckets[4]!.to)).toBe('2026-05-31T21:00:00.000Z')
    for (let i = 0; i < 4; i++)
      expect(buckets[i]!.to.getTime()).toBe(buckets[i + 1]!.from.getTime())
  })

  it('picks weeks up to 92 days and months beyond', () => {
    expect(reportGranularity('2026-04-01', '2026-07-01')).toBe('week') // 92 дня
    expect(reportGranularity('2026-04-01', '2026-07-02')).toBe('month') // 93 дня
  })

  it('switches to calendar months for long periods', () => {
    const buckets = reportBuckets('2026-01-01', '2026-12-31', MINSK)
    expect(buckets).toHaveLength(12)
    expect(buckets[1]).toMatchObject({ fromDate: '2026-02-01', toDate: '2026-02-28' })
    expect(buckets[11]).toMatchObject({ fromDate: '2026-12-01', toDate: '2026-12-31' })
  })
})
