// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AllPaymentsLink from './AllPaymentsLink.vue'
import DashboardCards from './DashboardCards.vue'

import type { DesktopDashboardView } from '~/utils/desktop-dashboard'

const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

describe('«Все оплаты» links (20.5.3 close-out)', () => {
  it('points to the payments page of the given group', () => {
    const wrapper = mount(AllPaymentsLink, { props: { orgId: 42 }, global: { stubs } })
    const link = wrapper.get('a')
    expect(link.text()).toBe('Все оплаты')
    expect(link.attributes('href')).toBe('/app/orgs/42/payments')
  })

  it('is shown on the cabinet overview for the current group', () => {
    const view = {
      balance: { balance: 100, currency: 'BYN' },
      pendingCount: 3,
      pendingAmount: 4500,
    } as unknown as DesktopDashboardView
    const wrapper = mount(DashboardCards, {
      props: { view, orgId: 9 },
      global: { stubs: { ...stubs, DesktopAllPaymentsLink: AllPaymentsLink } },
    })
    expect(wrapper.get('a[href="/app/orgs/9/payments"]').text()).toBe('Все оплаты')
  })
})
