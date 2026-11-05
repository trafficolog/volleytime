// @vitest-environment happy-dom
import type { ManagerOverview } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DashboardCashWeeks from './DashboardCashWeeks.vue'

const cash: ManagerOverview['cashWeekly'] = {
  currency: 'BYN',
  weeks: [
    { from: '2026-10-12T21:00:00Z', to: '2026-10-19T21:00:00Z', income: 0, expense: 0, net: 0 },
    {
      from: '2026-10-19T21:00:00Z',
      to: '2026-10-26T21:00:00Z',
      income: 5000,
      expense: 1000,
      net: 4000,
    },
    {
      from: '2026-10-26T21:00:00Z',
      to: '2026-11-02T21:00:00Z',
      income: 2000,
      expense: 6000,
      net: -4000,
    },
    {
      from: '2026-11-02T21:00:00Z',
      to: '2026-11-09T21:00:00Z',
      income: 8250,
      expense: 0,
      net: 8250,
    },
  ],
  total: { income: 15250, expense: 7000, net: 8250 },
}

describe('cash for 4 weeks chart (21.2.1, W-02)', () => {
  it('shows the headline from the 4-week net and one labelled bar per week', () => {
    const wrapper = mount(DashboardCashWeeks, { props: { cash, tz: 'Europe/Minsk' } })

    expect(wrapper.get('.vt-desktop-dashboard__cash-headline').text()).toBe('+82,50 BYN')
    const weeks = wrapper.findAll('.vt-desktop-dashboard__weeks > li')
    expect(weeks).toHaveLength(4)
    expect(weeks[3]!.classes()).toContain('is-current')
    expect(weeks[2]!.text()).toContain('-40,00 BYN')
  })

  it('marks a negative 4-week net in the headline', () => {
    const negative = { ...cash, total: { income: 0, expense: 4000, net: -4000 } }
    const wrapper = mount(DashboardCashWeeks, { props: { cash: negative, tz: 'Europe/Minsk' } })

    expect(wrapper.get('.vt-desktop-dashboard__cash-headline').text()).toBe('-40,00 BYN')
    expect(wrapper.get('.vt-desktop-dashboard__cash-headline').classes()).toContain('is-negative')
  })

  it('scales the bar of the largest absolute net to full height', () => {
    const wrapper = mount(DashboardCashWeeks, { props: { cash, tz: 'Europe/Minsk' } })
    const bars = wrapper.findAll('.vt-desktop-dashboard__week-bar')
    expect(bars[3]!.attributes('style')).toContain('height: 100%')
    expect(bars[1]!.attributes('style')).toContain('height: 48%')
  })
})
