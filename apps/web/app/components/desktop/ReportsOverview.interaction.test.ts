// @vitest-environment happy-dom
import type { ManagerReport } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ReportsOverview from './ReportsOverview.vue'

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
  attendance: {
    visits: 40,
    noShows: 2,
    cancellations: 3,
    top: [
      {
        userId: 1,
        name: 'Артём',
        telegramUsername: null,
        level: null,
        visits: 12,
        seats: 12,
        noShows: 0,
        cancellations: 1,
        lastVisitAt: '2026-05-28T10:00:00Z',
      },
      {
        userId: 2,
        name: null,
        telegramUsername: 'masha',
        level: null,
        visits: 10,
        seats: 10,
        noShows: 1,
        cancellations: 0,
        lastVisitAt: null,
      },
    ],
  },
}

describe('reports overview (21.2.7, W-10)', () => {
  it('shows the four KPI tiles, the cash bars, the expense categories and the top', () => {
    const wrapper = mount(ReportsOverview, { props: { report } })

    const kpis = wrapper.findAll('.vt-desktop-reports__kpis > li')
    expect(kpis.map((k) => k.get('strong').text())).toEqual([
      '+248,50 BYN',
      '+318,50 BYN',
      '−70,00 BYN',
      '87%',
    ])
    expect(wrapper.get('#reports-cash-title').text()).toBe('Касса по неделям')
    expect(wrapper.findAll('.vt-desktop-reports__bars > li')).toHaveLength(2)
    expect(wrapper.text()).toContain('+248,50 BYN нетто')

    const categories = wrapper.findAll('.vt-desktop-reports__categories > li')
    expect(categories.map((c) => c.text())).toEqual([
      expect.stringContaining('Аренда'),
      expect.stringContaining('Зарплата (прежние записи)'),
      expect.stringContaining('Тренер'),
    ])

    const top = wrapper.findAll('.vt-desktop-reports__top > li')
    expect(top[0]!.text()).toContain('Артём')
    expect(top[0]!.text()).toContain('12 трен.')
    expect(top[1]!.text()).toContain('@masha')
    expect(wrapper.get('.vt-desktop-reports__attendance').text()).toBe(
      'Визитов 40 · неявок 2 · отмен 3',
    )
  })

  it('titles the chart by months for long periods and shows empty states without data', () => {
    const empty: ManagerReport = {
      ...report,
      money: {
        income: 0,
        expense: 0,
        net: 0,
        granularity: 'month',
        buckets: [],
        expenseByCategory: [],
      },
      attendance: { visits: 0, noShows: 0, cancellations: 0, top: [] },
      occupancy: { ...report.occupancy, percent: null },
    }
    const wrapper = mount(ReportsOverview, { props: { report: empty } })
    expect(wrapper.get('#reports-cash-title').text()).toBe('Касса по месяцам')
    expect(wrapper.text()).toContain('Нет операций за период.')
    expect(wrapper.text()).toContain('Расходов за период нет.')
    expect(wrapper.text()).toContain('За период никто не отмечен как пришедший.')
    expect(wrapper.findAll('.vt-desktop-reports__kpis > li')[3]!.get('strong').text()).toBe('—')
  })
})
