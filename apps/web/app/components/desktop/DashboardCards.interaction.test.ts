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
    timezone: 'Europe/Minsk',
    currency: 'BYN',
    deltas: {
      previousMonth: { from: '2026-09-30T21:00:00.000Z', to: '2026-10-31T21:00:00.000Z' },
      eventsVsPreviousMonth: 3,
      subscriptionsExpiringSoon: 2,
      cashWeekNet: 8250,
    },
  },
} as unknown as DesktopDashboardView

describe('dashboard stat tiles (21.2.1, W-02)', () => {
  it('keeps the group cash block with the current balance', () => {
    const wrapper = mount(DashboardCards, { props: { view, showSubscriptions: true } })
    expect(wrapper.get('#desktop-balance-title').text()).toBe('Касса группы')
    expect(wrapper.get('.vt-desktop-dashboard__balance-value').text()).toBe('248,50 BYN')
  })

  it('shows events of the month, bookings with occupancy and active subscriptions from overview', () => {
    const wrapper = mount(DashboardCards, { props: { view, showSubscriptions: true } })
    const text = wrapper.text()

    expect(wrapper.get('[aria-labelledby="desktop-events-title"]').text()).toContain('12')
    expect(wrapper.get('[aria-labelledby="desktop-bookings-title"]').text()).toContain('168')
    expect(wrapper.get('[aria-labelledby="desktop-bookings-title"]').text()).toContain(
      'Заполненность 83%',
    )
    expect(wrapper.get('[aria-labelledby="desktop-subs-title"]').text()).toContain('9')
    expect(text).toContain('+3 к октябрю')
    expect(text).toContain('2 истекают на неделе')
    expect(text).toContain('+82,50 BYN за неделю')
  })

  it('omits captions that have nothing to show', () => {
    const wrapper = mount(DashboardCards, {
      props: {
        view: {
          ...view,
          overview: {
            ...view.overview,
            deltas: {
              ...view.overview.deltas,
              eventsVsPreviousMonth: null,
              subscriptionsExpiringSoon: 0,
            },
          },
        } as unknown as DesktopDashboardView,
        showSubscriptions: true,
      },
    })
    const text = wrapper.text()
    expect(text).not.toMatch(/к октябрю|истека/)
    expect(text).toContain('за неделю')
  })

  it('hides the subscriptions tile when subscriptions are off or the organization is not loaded', () => {
    const wrapper = mount(DashboardCards, { props: { view, showSubscriptions: false } })
    expect(wrapper.find('[aria-labelledby="desktop-subs-title"]').exists()).toBe(false)
    expect(wrapper.find('[aria-labelledby="desktop-events-title"]').exists()).toBe(true)
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
        showSubscriptions: true,
      },
    })
    expect(wrapper.get('[aria-labelledby="desktop-bookings-title"]').text()).toContain(
      'Заполненность —',
    )
  })
})
