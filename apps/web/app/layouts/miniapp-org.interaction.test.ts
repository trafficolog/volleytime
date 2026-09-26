// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref, Suspense, watch } from 'vue'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'

import Sheet from '../components/vt/Sheet.vue'
import TabBar from '../components/vt/TabBar.vue'

import MiniappOrg from './miniapp-org.vue'

const route = {
  params: { orgId: '7' },
  fullPath: '/m/orgs/7',
  path: '/m/orgs/7',
}
let memberRole: 'owner' | 'player' = 'owner'

vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('useFetch', (url: () => string) => {
  const path = url()
  return {
    data: ref(
      path.endsWith('/subscriptions/my')
        ? { subscriptions: [] }
        : {
            organization: { id: 7, subscriptionsEnabled: true },
            myMember: { role: memberRole, status: 'active' },
          },
    ),
    error: ref(null),
    refresh: vi.fn(),
  }
})

async function renderLayout(role: 'owner' | 'player') {
  memberRole = role
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/m/orgs/7', component: { template: '<div />' } },
      { path: '/m/orgs/7/events', component: { template: '<div />' } },
      { path: '/m/orgs/7/bookings', component: { template: '<div />' } },
      { path: '/m/orgs/7/subscriptions', component: { template: '<div />' } },
      { path: '/m/orgs/7/members', component: { template: '<div />' } },
      { path: '/m/orgs/7/cashbox', component: { template: '<div />' } },
      { path: '/m/orgs/7/payments', component: { template: '<div />' } },
    ],
  })
  await router.push('/m/orgs/7')
  await router.isReady()
  const host = defineComponent({
    render: () => h(Suspense, null, { default: () => h(MiniappOrg) }),
  })
  const wrapper = mount(host, {
    attachTo: document.body,
    global: {
      plugins: [router],
      components: {
        VtTabBar: TabBar,
        VtSheet: Sheet,
        VtIcon: { template: '<span aria-hidden="true" />' },
        OfflineBanner: { template: '<div />' },
      },
      stubs: { NuxtLink: RouterLink },
    },
  })
  await nextTick()
  await nextTick()
  return { wrapper, router }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Mini App layout navigation interaction', () => {
  it('opens the rendered menu sheet when its tab button is clicked', async () => {
    const { wrapper } = await renderLayout('owner')
    const button = wrapper.get('button[aria-controls="organizer-menu-dialog"]')
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(document.querySelector('#organizer-menu-dialog[role="dialog"]')).not.toBeNull()
    expect(
      document.querySelector('#organizer-menu-dialog a[href="/m/orgs/7/settings"]'),
    ).not.toBeNull()
    wrapper.unmount()
  })

  it('keeps player tabs as navigable links without a menu button', async () => {
    const { wrapper, router } = await renderLayout('player')
    expect(wrapper.find('button[aria-controls="organizer-menu-dialog"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/m/orgs/7/events"]').exists()).toBe(true)
    await wrapper.get('a[href="/m/orgs/7/events"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/m/orgs/7/events')
    wrapper.unmount()
  })
})
