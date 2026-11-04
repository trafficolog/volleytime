// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DashboardCards from './DashboardCards.vue'

import type { DesktopDashboardView } from '~/utils/desktop-dashboard'

const view = {
  balance: { currency: 'BYN', balance: 24850 },
  upcoming: [],
  overview: {
    events: { thisMonth: 12 },
    bookings: { count: 168, seats: 150, capacity: 180, occupancyPercent: 83 },
    subscriptions: { active: 9 },
  },
} as unknown as DesktopDashboardView

describe('dashboard stat tiles (21.2.1, W-02)', () => {
  it('keeps the group cash block with the current balance', () => {
    const wrapper = mount(DashboardCards, { props: { view } })
    expect(wrapper.get('#desktop-balance-title').text()).toBe('Касса группы')
    expect(wrapper.get('.vt-desktop-dashboard__balance-value').text()).toBe('248,50 BYN')
  })

  it('shows events of the month, bookings with occupancy and active subscriptions from overview', () => {
    const wrapper = mount(DashboardCards, { props: { view } })
    const text = wrapper.text()

    expect(wrapper.get('[aria-labelledby="desktop-events-title"]').text()).toContain('12')
    expect(wrapper.get('[aria-labelledby="desktop-bookings-title"]').text()).toContain('168')
    expect(wrapper.get('[aria-labelledby="desktop-bookings-title"]').text()).toContain(
      'Заполненность 83%',
    )
    expect(wrapper.get('[aria-labelledby="desktop-subs-title"]').text()).toContain('9')
    expect(text).not.toMatch(/к апрелю|истекают|на неделе/)
  })

  it('shows a dash for occupancy when the API gives null', () => {
    const wrapper = mount(DashboardCards, {
      props: {
        view: {
          ...view,
          overview: {
            ...view.overview,
            bookings: { count: 0, seats: 0, capacity: 0, occupancyPercent: null },
          },
        } as unknown as DesktopDashboardView,
      },
    })
    expect(wrapper.get('[aria-labelledby="desktop-bookings-title"]').text()).toContain(
      'Заполненность —',
    )
  })
})
