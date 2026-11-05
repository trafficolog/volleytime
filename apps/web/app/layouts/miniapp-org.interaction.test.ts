// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  Suspense,
  useTemplateRef,
  watch,
} from 'vue'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'

import Sheet from '../components/vt/Sheet.vue'
import TabBar from '../components/vt/TabBar.vue'

import MiniappOrg from './miniapp-org.vue'

const route = reactive({
  params: { orgId: '7' },
  fullPath: '/m/orgs/7',
  path: '/m/orgs/7',
})
let memberRole: 'owner' | 'player' = 'owner'
let subscriptionsEnabled = true
let organizationResponseId = 7
let organizationStatus = 'active'
let subscriptionBalances: unknown[] = []
let collectionsFlag = true
let groupCollections: unknown[] = []
const collectionsFetch = vi.fn(async (_url: string) => ({ collections: groupCollections }))
vi.stubGlobal('$fetch', collectionsFetch)

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
            capabilities: { collections: collectionsFlag },
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
      { path: '/m/orgs/7/collections', component: { template: '<div />' } },
      { path: '/m/orgs/7/collections/3', component: { template: '<div />' } },
      { path: '/m/orgs/7/members', component: { template: '<div />' } },
      { path: '/m/orgs/7/cashbox', component: { template: '<div />' } },
      { path: '/m/orgs/7/payments', component: { template: '<div />' } },
      { path: '/m/orgs/7/profile', component: { template: '<div />' } },
    ],
  })
  await router.push(route.path)
  await router.isReady()
  router.afterEach((to) => {
    route.path = to.path
    route.fullPath = to.fullPath
  })
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

// Node 26 shadows happy-dom's localStorage with an unusable stub: use a plain in-memory one.
beforeEach(() => {
  const data = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    },
  })
})

afterEach(() => {
  document.body.innerHTML = ''
  organizationResponseId = 7
  organizationStatus = 'active'
  subscriptionBalances = []
  collectionsFlag = true
  groupCollections = []
  collectionsFetch.mockClear()
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
    expect(wrapper.findAll('nav[aria-label="Разделы"] a')).toHaveLength(4)
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
    expect(wrapper.findAll('nav[aria-label="Разделы"] a')).toHaveLength(4)
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
    expect(wrapper.findAll('nav[aria-label="Разделы"] a')).toHaveLength(3)
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
      expect(wrapper.findAll('nav[aria-label="Разделы"] a')).toHaveLength(3)
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

  it('puts Сборы between Абонементы and Профиль for players', async () => {
    const { wrapper } = await renderLayout('player', true)
    expect(wrapper.findAll('nav[aria-label="Разделы"] a').map((a) => a.attributes('href'))).toEqual(
      ['/m/orgs/7', '/m/orgs/7/subscriptions', '/m/orgs/7/collections', '/m/orgs/7/profile'],
    )
    wrapper.unmount()
  })

  it('puts Сборы between Оплаты and Меню for organizers and keeps Оплаты (21.1.5)', async () => {
    const { wrapper } = await renderLayout('owner')
    await flushPromises()
    const nav = wrapper.get('nav[aria-label="Разделы"]')
    expect(nav.findAll('a').map((a) => a.attributes('href'))).toEqual([
      '/m/orgs/7',
      '/m/orgs/7/members',
      '/m/orgs/7/cashbox',
      '/m/orgs/7/payments',
      '/m/orgs/7/collections',
    ])
    expect(nav.findAll('a, button').map((el) => el.text().replace(/\s+/g, ' ').trim())).toEqual([
      'События',
      'Игроки',
      'Касса',
      'Оплаты',
      'Сборы , новое',
      'Меню',
    ])
    wrapper.unmount()
  })

  it('organizer Сборы dot burns until the tab is opened (21.1.5)', async () => {
    const first = await renderLayout('owner')
    await flushPromises()
    const link = () => first.wrapper.get('a[href="/m/orgs/7/collections"]')
    expect(link().find('.vt-tabbar__dot').exists()).toBe(true)
    await link().trigger('click')
    await flushPromises()
    await nextTick()
    expect(link().find('.vt-tabbar__dot').exists()).toBe(false)
    first.wrapper.unmount()
    route.path = '/m/orgs/7'
    route.fullPath = '/m/orgs/7'
  })

  it('organizer with the flag off and no collections does not get the tab (21.1.5)', async () => {
    collectionsFlag = false
    const { wrapper } = await renderLayout('owner')
    await flushPromises()
    expect(collectionsFetch).toHaveBeenCalledWith('/api/organizations/7/collections?limit=1')
    expect(wrapper.find('a[href="/m/orgs/7/collections"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('organizer with the flag off still gets the tab while collections exist (21.1.5)', async () => {
    collectionsFlag = false
    groupCollections = [{ id: 1 }]
    const { wrapper } = await renderLayout('owner')
    await flushPromises()
    expect(wrapper.find('a[href="/m/orgs/7/collections"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the new-tab dot on Сборы until the tab is opened, then keeps it off', async () => {
    const first = await renderLayout('player')
    await flushPromises()
    const link = () => first.wrapper.get('a[href="/m/orgs/7/collections"]')
    expect(link().find('.vt-tabbar__dot').exists()).toBe(true)
    expect(link().text()).toContain('новое')
    await link().trigger('click')
    await flushPromises()
    await nextTick()
    expect(first.router.currentRoute.value.path).toBe('/m/orgs/7/collections')
    expect(link().find('.vt-tabbar__dot').exists()).toBe(false)
    expect(link().attributes('aria-current')).toBe('page')
    first.wrapper.unmount()

    route.path = '/m/orgs/7'
    route.fullPath = '/m/orgs/7'
    const again = await renderLayout('player')
    await flushPromises()
    expect(
      again.wrapper.get('a[href="/m/orgs/7/collections"]').find('.vt-tabbar__dot').exists(),
    ).toBe(false)
    again.wrapper.unmount()
  })

  it('opening Сборы directly on a detail screen also clears the dot', async () => {
    route.path = '/m/orgs/7/collections/3'
    route.fullPath = '/m/orgs/7/collections/3'
    try {
      const { wrapper } = await renderLayout('player')
      await flushPromises()
      expect(wrapper.find('.vt-tabbar__dot').exists()).toBe(false)
      expect(wrapper.get('a[href="/m/orgs/7/collections"]').attributes('aria-current')).toBe('page')
      wrapper.unmount()
    } finally {
      route.path = '/m/orgs/7'
      route.fullPath = '/m/orgs/7'
    }
  })

  it('hides Сборы when the flag is off and the group has no collections', async () => {
    collectionsFlag = false
    const { wrapper } = await renderLayout('player')
    await flushPromises()
    expect(collectionsFetch).toHaveBeenCalledWith('/api/organizations/7/collections?limit=1')
    expect(wrapper.find('a[href="/m/orgs/7/collections"]').exists()).toBe(false)
    expect(wrapper.findAll('nav[aria-label="Разделы"] a')).toHaveLength(3)
    wrapper.unmount()
  })

  it('shows Сборы for viewing when the flag is off but the group has collections', async () => {
    collectionsFlag = false
    groupCollections = [{ id: 1 }]
    const { wrapper } = await renderLayout('player')
    await flushPromises()
    expect(wrapper.find('a[href="/m/orgs/7/collections"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows Сборы without an extra request when the flag is on', async () => {
    const { wrapper } = await renderLayout('player')
    await flushPromises()
    expect(wrapper.find('a[href="/m/orgs/7/collections"]').exists()).toBe(true)
    expect(collectionsFetch).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('hides Сборы when the collections request fails with the flag off', async () => {
    collectionsFlag = false
    collectionsFetch.mockRejectedValueOnce(new Error('boom'))
    const { wrapper } = await renderLayout('player')
    await flushPromises()
    expect(wrapper.find('a[href="/m/orgs/7/collections"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
