import type { ManagerReport } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import { reportKpis } from './desktop-reports'
import {
  currentMonthKey,
  miniappReportView,
  monthFromQuery,
  reportMonthPeriod,
  shiftReportMonth,
} from './miniapp-report'

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
    buckets: [],
    expenseByCategory: [],
  },
  occupancy: {
    events: 12,
    seats: 87,
    capacity: 100,
    percent: 87,
    previous: { events: 10, seats: 82, capacity: 100, percent: 82 },
  },
  attendance: {
    visits: 40,
    noShows: 2,
    cancellations: 3,
    top: Array.from({ length: 7 }, (_, i) => ({
      userId: i + 1,
      name: i === 1 ? null : `Игрок ${i + 1}`,
      telegramUsername: i === 1 ? 'masha' : null,
      level: null,
      visits: 12 - i,
      seats: 12 - i,
      noShows: 0,
      cancellations: 0,
      lastVisitAt: null,
    })),
  },
}

describe('Mini App month report period', () => {
  it('uses the group-local current month', () => {
    // 23:30 UTC 30 April is already 1 May in Minsk (UTC+3)
    const now = new Date('2026-04-30T23:30:00Z')
    expect(currentMonthKey(now, 'Europe/Minsk')).toBe('2026-05')
    expect(currentMonthKey(now, 'UTC')).toBe('2026-04')
  })

  it('shifts across year boundaries', () => {
    expect(shiftReportMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftReportMonth('2025-12', 1)).toBe('2026-01')
    expect(shiftReportMonth('2026-05', -3)).toBe('2026-02')
  })

  it('builds inclusive month dates and label from the cabinet presets', () => {
    expect(reportMonthPeriod('2026-05')).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
      label: 'Май 2026',
    })
    expect(reportMonthPeriod('2024-02')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
      label: 'Февраль 2024',
    })
  })

  it('falls back to the current month for a bad or future query month', () => {
    expect(monthFromQuery('2026-04', '2026-05')).toBe('2026-04')
    expect(monthFromQuery('2026-05', '2026-05')).toBe('2026-05')
    expect(monthFromQuery('2026-06', '2026-05')).toBe('2026-05')
    expect(monthFromQuery('2026-13', '2026-05')).toBe('2026-05')
    expect(monthFromQuery('май', '2026-05')).toBe('2026-05')
    expect(monthFromQuery(undefined, '2026-05')).toBe('2026-05')
    expect(monthFromQuery(['2026-04'], '2026-05')).toBe('2026-05')
  })
})

describe('Mini App month report view parity with the cabinet (W-10)', () => {
  it('shows exactly the cabinet KPI strings for net, income, expense and occupancy', () => {
    const view = miniappReportView(report)
    const [net, income, expense, occupancy] = reportKpis(report)
    expect(view.net.value).toBe(net!.value)
    expect(view.income).toBe(income!.value)
    expect(view.expense).toBe(expense!.value)
    expect(view.occupancy).toEqual({ value: occupancy!.value, caption: occupancy!.caption })
    expect(view).toMatchObject({
      net: { value: '+248,50 BYN', negative: false },
      income: '+318,50 BYN',
      expense: '−70,00 BYN',
      events: { value: '12' },
      occupancy: { value: '87%' },
      visits: { value: '40', caption: 'неявок 2 · отмен 3' },
    })
  })

  it('marks a negative month and keeps the sign', () => {
    const loss = {
      ...report,
      money: { ...report.money, income: 1000, expense: 4000, net: -3000 },
    }
    const view = miniappReportView(loss)
    expect(view.net.negative).toBe(true)
    expect(view.net.value).toBe(reportKpis(loss)[0]!.value)
  })

  it('shows the first five most active players with the cabinet name rule', () => {
    const { top } = miniappReportView(report)
    expect(top).toHaveLength(5)
    expect(top[0]).toEqual({ userId: 1, name: 'Игрок 1', visits: '12 трен.' })
    expect(top[1]!.name).toBe('@masha')
  })

  it('handles an empty month', () => {
    const empty: ManagerReport = {
      ...report,
      money: { ...report.money, income: 0, expense: 0, net: 0 },
      occupancy: {
        events: 0,
        seats: 0,
        capacity: 0,
        percent: null,
        previous: { events: 0, seats: 0, capacity: 0, percent: null },
      },
      attendance: { visits: 0, noShows: 0, cancellations: 0, top: [] },
    }
    const view = miniappReportView(empty)
    expect(view.occupancy.value).toBe('—')
    expect(view.top).toEqual([])
    expect(view.events.value).toBe('0')
  })
})
