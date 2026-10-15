// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  Suspense,
  useTemplateRef,
  watch,
} from 'vue'
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
let subscriptionsEnabled = true
let organizationResponseId = 7
let organizationStatus = 'active'
let subscriptionBalances: unknown[] = []

vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('useTemplateRef', useTemplateRef)
vi.stubGlobal('useHead', () => undefined)
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
)
vi.stubGlobal('useFetch', (url: () => string) => {
  const path = url()
  return {
    data: ref(
      path.endsWith('/subscriptions/my')
        ? { subscriptions: subscriptionBalances }
        : {
            organization: {
              id: organizationResponseId,
              status: organizationStatus,
              subscriptionsEnabled,
            },
            myMember: { role: memberRole, status: 'active' },
          },
    ),
    error: ref(null),
    refresh: vi.fn(),
  }
})

async function renderLayout(role: 'owner' | 'player', enabled = true) {
  memberRole = role
  subscriptionsEnabled = enabled
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
      { path: '/m/orgs/7/profile', component: { template: '<div />' } },
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
  organizationResponseId = 7
  organizationStatus = 'active'
  subscriptionBalances = []
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
    expect(wrapper.findAll('nav[aria-label="Разделы"] a')).toHaveLength(3)
    expect(wrapper.find('a[href="/m/orgs/7/bookings"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/m/orgs/7/profile"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/m/orgs/7/events"]').exists()).toBe(false)
    await wrapper.get('a[href="/m/orgs/7/profile"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/m/orgs/7/profile')
    wrapper.unmount()
  })

  it('shows Абонементы with an active unspent balance even when subscriptions are off', async () => {
    subscriptionBalances = [
      {
        organizationId: 7,
        status: 'active',
        usedSessions: 2,
        totalSessions: 8,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ]
    const { wrapper } = await renderLayout('player', false)
    expect(wrapper.findAll('nav[aria-label="Разделы"] a')).toHaveLength(3)
    expect(wrapper.find('a[href="/m/orgs/7/subscriptions"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('hides Абонементы when subscriptions are off and no balance remains', async () => {
    subscriptionBalances = [
      {
        organizationId: 7,
        status: 'active',
        usedSessions: 8,
        totalSessions: 8,
        expiresAt: null,
      },
    ]
    const { wrapper } = await renderLayout('player', false)
    expect(wrapper.find('a[href="/m/orgs/7/subscriptions"]').exists()).toBe(false)
    expect(wrapper.findAll('nav[aria-label="Разделы"] a')).toHaveLength(2)
    wrapper.unmount()
  })

  it('shows Абонементы when subscriptions are on regardless of balance', async () => {
    const { wrapper } = await renderLayout('player', true)
    expect(wrapper.find('a[href="/m/orgs/7/subscriptions"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('marks no tab as current when the active route belongs to a hidden tab', async () => {
    route.path = '/m/orgs/7/subscriptions'
    route.fullPath = '/m/orgs/7/subscriptions'
    try {
      const { wrapper } = await renderLayout('player', false)
      expect(wrapper.findAll('[aria-current="page"]')).toHaveLength(0)
      expect(wrapper.findAll('nav[aria-label="Разделы"] a')).toHaveLength(2)
      wrapper.unmount()
    } finally {
      route.path = '/m/orgs/7'
      route.fullPath = '/m/orgs/7'
    }
  })

  it('hides tabs and manager menu while the organization response belongs to another group', async () => {
    organizationResponseId = 8
    const { wrapper } = await renderLayout('owner')
    expect(wrapper.find('nav[aria-label="Разделы"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-controls="organizer-menu-dialog"]').exists()).toBe(false)
    expect(document.querySelector('#organizer-menu-dialog')).toBeNull()
    wrapper.unmount()
  })

  it('does not mount the manager menu for a suspended group', async () => {
    organizationStatus = 'suspended'
    const { wrapper } = await renderLayout('owner')
    expect(wrapper.find('nav[aria-label="Разделы"]').exists()).toBe(false)
    expect(wrapper.findComponent(Sheet).exists()).toBe(false)
    wrapper.unmount()
  })
})
