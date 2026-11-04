// @vitest-environment happy-dom
import type { ManagerOverview } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AllPaymentsLink from './AllPaymentsLink.vue'
import DashboardPendingPayments from './DashboardPendingPayments.vue'

const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

const row = (id: number, name: string | null) => ({
  id,
  amount: 2500,
  currency: 'BYN',
  seats: 1,
  createdAt: '2026-11-04T10:00:00Z',
  user: { id: id + 100, name, telegramUsername: null },
  event: { id: 9, title: 'Тренировка', startsAt: '2026-11-08T16:00:00Z' },
  plan: null,
  collection: null,
})

const pending = (
  count: number,
  items: ReturnType<typeof row>[],
): ManagerOverview['pendingPayments'] => ({
  count,
  amount: 2500 * items.length,
  currency: 'BYN',
  items,
})

describe('pending payments list (21.2.1, W-02)', () => {
  it('takes the count from the number of rows and lists them with amounts', () => {
    const wrapper = mount(DashboardPendingPayments, {
      props: { pending: pending(2, [row(1, 'Иван'), row(2, 'Соня')]), orgId: 9 },
      global: { stubs: { ...stubs, DesktopAllPaymentsLink: AllPaymentsLink } },
    })

    expect(wrapper.get('.vt-desktop-dashboard__pending-badge').text()).toBe('2 ждут')
    const rows = wrapper.findAll('.vt-desktop-dashboard__payment')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Иван')
    expect(rows[0]!.text()).toContain('25,00 BYN')
  })

  it('counts every waiting row but shows the first four, the rest via the payments page', () => {
    const items = [1, 2, 3, 4, 5, 6].map((id) => row(id, `Игрок ${id}`))
    const wrapper = mount(DashboardPendingPayments, {
      props: { pending: pending(6, items), orgId: 9 },
      global: { stubs: { ...stubs, DesktopAllPaymentsLink: AllPaymentsLink } },
    })

    expect(wrapper.get('.vt-desktop-dashboard__pending-badge').text()).toBe('6 ждут')
    expect(wrapper.findAll('.vt-desktop-dashboard__payment')).toHaveLength(4)
    expect(wrapper.get('a[href="/app/orgs/9/payments"]').exists()).toBe(true)
  })

  it('uses the singular form for one pending payment', () => {
    const wrapper = mount(DashboardPendingPayments, {
      props: { pending: pending(1, [row(1, 'Иван')]), orgId: 9 },
      global: { stubs: { ...stubs, DesktopAllPaymentsLink: AllPaymentsLink } },
    })
    expect(wrapper.get('.vt-desktop-dashboard__pending-badge').text()).toBe('1 ждёт')
  })

  it('shows an empty state when nothing waits for confirmation', () => {
    const wrapper = mount(DashboardPendingPayments, {
      props: { pending: pending(0, []), orgId: 9 },
      global: { stubs: { ...stubs, DesktopAllPaymentsLink: AllPaymentsLink } },
    })
    expect(wrapper.findAll('.vt-desktop-dashboard__payment')).toHaveLength(0)
    expect(wrapper.text()).toContain('Ожидающих оплат нет.')
  })

  it('keeps the all-payments link for the current group', () => {
    const wrapper = mount(DashboardPendingPayments, {
      props: { pending: pending(0, []), orgId: 9 },
      global: { stubs: { ...stubs, DesktopAllPaymentsLink: AllPaymentsLink } },
    })
    expect(wrapper.get('a[href="/app/orgs/9/payments"]').text()).toBe('Все оплаты')
  })
})
