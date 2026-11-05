import type { ManagerReport } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  exportTypeFromQuery,
  expenseCategoryRows,
  formatExportSize,
  periodFromQuery,
  reportCashBars,
  reportExportHref,
  reportKpis,
  reportPlayerName,
  reportQuery,
} from './desktop-reports'

const bucket = (fromDate: string, toDate: string, income: number, expense: number) => ({
  from: `${fromDate}T00:00:00Z`,
  to: `${toDate}T00:00:00Z`,
  fromDate,
  toDate,
  income,
  expense,
  net: income - expense,
})

const report: ManagerReport = {
  timezone: 'Europe/Minsk',
  currency: 'BYN',
  period: { from: '2026-05-01', to: '2026-05-31' },
  previous: { from: '2026-03-31', to: '2026-04-30' },
  money: {
    income: 31850,
    expense: 7000,
    net: 24850,
    granularity: 'week',
    buckets: [
      bucket('2026-05-01', '2026-05-03', 6800, 1800),
      bucket('2026-05-04', '2026-05-10', 8400, 2600),
      bucket('2026-05-11', '2026-05-17', 7200, 1200),
      bucket('2026-05-18', '2026-05-24', 9450, 1400),
    ],
    expenseByCategory: [
      { category: 'rent', amount: 4200, count: 2 },
      { category: 'salary', amount: 1800, count: 1 },
      { category: 'coach', amount: 1000, count: 1 },
    ],
  },
  occupancy: {
    events: 12,
    seats: 87,
    capacity: 100,
    percent: 87,
    previous: { events: 10, seats: 82, capacity: 100, percent: 82 },
  },
  attendance: { visits: 40, noShows: 2, cancellations: 3, top: [] },
}

describe('reportKpis', () => {
  it('builds the four tiles from the report, with deltas and plurals', () => {
    const [net, income, expense, occupancy] = reportKpis(report)
    expect(net).toMatchObject({ label: 'Чистая касса', value: '+248,50 BYN', tone: 'positive' })
    expect(net!.caption).toBe('+80,50 BYN последняя неделя')
    expect(income).toMatchObject({ label: 'Поступления', value: '+318,50 BYN' })
    expect(income!.caption).toBe('12 событий')
    expect(expense).toMatchObject({ label: 'Расходы', value: '−70,00 BYN', tone: 'negative' })
    expect(expense!.caption).toBe('3 категории')
    expect(occupancy).toMatchObject({ label: 'Заполняемость', value: '87%' })
    expect(occupancy!.caption).toBe('+5% к прошлому периоду')
  })

  it('handles empty periods: no occupancy, no previous data, zero money', () => {
    const empty: ManagerReport = {
      ...report,
      money: { ...report.money, income: 0, expense: 0, net: 0, buckets: [], expenseByCategory: [] },
      occupancy: {
        events: 0,
        seats: 0,
        capacity: 0,
        percent: null,
        previous: { events: 0, seats: 0, capacity: 0, percent: null },
      },
    }
    const [net, income, expense, occupancy] = reportKpis(empty)
    expect(net).toMatchObject({ value: '0,00 BYN', tone: 'neutral', caption: 'нет операций' })
    expect(income).toMatchObject({ value: '0,00 BYN', caption: '0 событий' })
    expect(expense!.caption).toBe('0 категорий')
    expect(occupancy).toMatchObject({ value: '—', caption: 'нет событий за период' })
  })

  it('says there is no previous data when the previous period had no capacity', () => {
    const [, , , occupancy] = reportKpis({
      ...report,
      occupancy: { ...report.occupancy, previous: { ...report.occupancy.previous, percent: null } },
    })
    expect(occupancy!.caption).toBe('нет данных за прошлый период')
  })

  it('shows a negative delta and the month label for yearly periods', () => {
    const [net, , , occupancy] = reportKpis({
      ...report,
      money: { ...report.money, granularity: 'month' },
      occupancy: { ...report.occupancy, percent: 70 },
    })
    expect(net!.caption).toContain('последний месяц')
    expect(occupancy!.caption).toBe('−12% к прошлому периоду')
  })
})

describe('reportCashBars', () => {
  it('labels weeks Н1.. and sizes the stacked bars against the biggest bucket', () => {
    const bars = reportCashBars(report)
    expect(bars.map((b) => b.label)).toEqual(['Н1', 'Н2', 'Н3', 'Н4'])
    // максимум — 8400 + 2600 = 11 000 → вся колонка
    expect(bars[1]).toMatchObject({ incomePercent: 76, expensePercent: 24 })
    expect(bars[0]!.incomePercent + bars[0]!.expensePercent).toBeLessThan(100)
    expect(bars[1]!.title).toBe('Н2: +84,00 BYN, −26,00 BYN')
  })

  it('uses short month names for monthly buckets and zero heights for no money', () => {
    const bars = reportCashBars({
      ...report,
      money: {
        ...report.money,
        granularity: 'month',
        buckets: [
          bucket('2026-01-01', '2026-01-31', 0, 0),
          bucket('2026-02-01', '2026-02-28', 0, 0),
        ],
      },
    })
    expect(bars.map((b) => b.label)).toEqual(['янв', 'фев'])
    expect(bars.every((b) => b.incomePercent === 0 && b.expensePercent === 0)).toBe(true)
  })
})

describe('expenseCategoryRows', () => {
  it('labels categories, keeps historical salary apart from coach and shares sum to the total', () => {
    const rows = expenseCategoryRows(report)
    expect(rows.map((r) => r.label)).toEqual(['Аренда', 'Зарплата (прежние записи)', 'Тренер'])
    expect(rows[0]).toMatchObject({ value: '−42,00 BYN', percent: 60 })
    expect(rows[1]).toMatchObject({ category: 'salary', value: '−18,00 BYN', percent: 26 })
  })

  it('returns no rows without expenses', () => {
    expect(
      expenseCategoryRows({
        ...report,
        money: { ...report.money, expense: 0, expenseByCategory: [] },
      }),
    ).toEqual([])
  })
})

describe('report helpers', () => {
  it('names a player by name, username, then a fallback', () => {
    expect(reportPlayerName({ name: 'Артём', telegramUsername: 'a' })).toBe('Артём')
    expect(reportPlayerName({ name: ' ', telegramUsername: 'a' })).toBe('@a')
    expect(reportPlayerName({ name: null, telegramUsername: null })).toBe('Игрок')
  })

  it('formats the export size in KB with a comma and a floor of 0,1', () => {
    expect(formatExportSize(4915)).toBe('≈ 4,8 КБ')
    expect(formatExportSize(2048)).toBe('≈ 2 КБ')
    expect(formatExportSize(0)).toBe('≈ 0,1 КБ')
  })

  it('reads the period and export type from the address, falling back on bad input', () => {
    const fallback = { from: '2026-06-01', to: '2026-06-30' }
    expect(periodFromQuery({ from: '2026-05-01', to: '2026-05-31' }, fallback)).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    })
    for (const bad of [
      {},
      { from: '2026-05-01' },
      { from: '2026-05-31', to: '2026-05-01' },
      { from: ['2026-05-01'], to: '2026-05-31' },
      { from: '2026-01-01', to: '2027-06-01' },
    ])
      expect(periodFromQuery(bad, fallback)).toBe(fallback)
    expect(exportTypeFromQuery('attendance')).toBe('attendance')
    expect(exportTypeFromQuery('subs')).toBe('finance')
    expect(exportTypeFromQuery(undefined)).toBe('finance')
  })

  it('builds the API query and the export link with the chosen columns', () => {
    expect(reportQuery({ from: '2026-05-01', to: '2026-05-31' })).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    })
    expect(
      reportExportHref(7, 'attendance', { from: '2026-05-01', to: '2026-05-31' }, [
        'player',
        'visits',
      ]),
    ).toBe(
      '/api/organizations/7/reports/export?type=attendance&from=2026-05-01&to=2026-05-31&columns=player%2Cvisits',
    )
    expect(reportExportHref(7, 'finance', { from: '2026-05-01', to: '2026-05-31' })).toBe(
      '/api/organizations/7/reports/export?type=finance&from=2026-05-01&to=2026-05-31',
    )
  })
})
