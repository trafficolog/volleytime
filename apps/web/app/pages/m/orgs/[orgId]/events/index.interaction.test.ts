// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Events from './index.vue'

const route = reactive({ params: { orgId: '30' } })
const orgData = ref({ organization: { id: 30 }, myMember: { role: 'owner', status: 'active' } })
const orgError = ref<Error | null>(null)
const navigateTo = vi.fn()
const apiFetch = vi.fn(async () => ({ events: [{ id: 1, title: 'Upcoming event' }] }))
const mounted: VueWrapper[] = []

vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
vi.stubGlobal('useFetch', () => ({ data: orgData, error: orgError }))
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('apiErrorMessage', () => 'Load failed')
vi.stubGlobal('apiErrorCode', (e: { code?: string }) => e.code)

function deferred() {
  let resolve!: (value: { events: { id: number; title: string }[] }) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<{ events: { id: number; title: string }[] }>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

async function renderEvents() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Events) }) })
  const wrapper = mount(host, {
    attachTo: document.body,
    global: {
      mocks: { navigateTo },
      stubs: {
        VtMiniHeader: { template: '<header><slot name="right" /></header>' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        VtIcon: { template: '<span />' },
        SkeletonList: { template: '<p>Loading events</p>' },
        ErrorState: {
          props: ['message'],
          template:
            '<div role="alert">{{ message }}<button @click="$emit(\'retry\')">Retry</button></div>',
        },
        EmptyState: { props: ['title'], template: '<p>{{ title }}<slot name="action" /></p>' },
        PlayerAccessNotice: { template: '<p>Access unavailable</p>' },
        OrganizerEventRow: { props: ['event'], template: '<p>{{ event.title }}</p>' },
        EventCard: { props: ['event'], template: '<p>{{ event.title }}</p>' },
      },
    },
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  route.params.orgId = '30'
  orgData.value = { organization: { id: 30 }, myMember: { role: 'owner', status: 'active' } }
  orgError.value = null
  navigateTo.mockReset()
  apiFetch.mockReset().mockResolvedValue({ events: [{ id: 1, title: 'Upcoming event' }] })
})
afterEach(() => mounted.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('event period refresh', () => {
  it('keeps the header action and focused filter mounted while disabling creation during loading', async () => {
    const wrapper = await renderEvents()
    const action = wrapper.get('.organizer-create-link').element as HTMLButtonElement
    const tab = wrapper.get('[role="tab"]:last-child').element as HTMLButtonElement
    const pending = deferred()
    apiFetch.mockImplementationOnce(() => pending.promise)
    tab.focus()
    tab.click()
    await flushPromises()
    expect(wrapper.find('.organizer-create-link').exists()).toBe(true)
    expect(wrapper.get('.organizer-create-link').element).toBe(action)
    expect(action.disabled).toBe(true)
    action.click()
    expect(navigateTo).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(tab)
    expect(wrapper.text()).toContain('Loading events')
    expect(wrapper.text()).not.toContain('Upcoming event')
    pending.resolve({ events: [{ id: 2, title: 'Past event' }] })
    await flushPromises()
    expect(wrapper.get('.organizer-create-link').element).toBe(action)
    expect(action.disabled).toBe(false)
    expect(document.activeElement).toBe(tab)
    action.click()
    expect(navigateTo).toHaveBeenCalledWith('/m/orgs/30/events/new')
  })

  it('shows an error without empty content and keeps creation disabled until retry succeeds', async () => {
    const wrapper = await renderEvents()
    const action = wrapper.get('.organizer-create-link').element as HTMLButtonElement
    apiFetch.mockRejectedValueOnce(new Error('failure'))
    await wrapper.get('[role="tab"]:last-child').trigger('click')
    await flushPromises()
    expect(wrapper.find('.organizer-create-link').exists()).toBe(true)
    expect(wrapper.get('.organizer-create-link').element).toBe(action)
    expect(action.disabled).toBe(true)
    action.click()
    expect(navigateTo).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('Load failed')
    expect(wrapper.text()).not.toContain('Прошедших событий нет')
    const retry = deferred()
    apiFetch.mockImplementationOnce(() => retry.promise)
    await wrapper.get('[role="alert"] button').trigger('click')
    expect(action.disabled).toBe(true)
    retry.resolve({ events: [] })
    await flushPromises()
    expect(action.disabled).toBe(false)
    expect(wrapper.text()).toContain('Прошедших событий нет')
  })

  it('ignores out-of-order rows and stale errors after a rapid period toggle', async () => {
    const wrapper = await renderEvents()
    const old = deferred()
    const latest = deferred()
    apiFetch.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => latest.promise)
    await wrapper.get('[role="tab"]:last-child').trigger('click')
    await wrapper.get('[role="tab"]:first-child').trigger('click')
    latest.resolve({ events: [{ id: 3, title: 'Latest upcoming' }] })
    await flushPromises()
    old.resolve({ events: [{ id: 2, title: 'Stale past' }] })
    await flushPromises()
    expect(wrapper.text()).toContain('Latest upcoming')
    expect(wrapper.text()).not.toContain('Stale past')
    const staleError = deferred()
    apiFetch.mockImplementationOnce(() => staleError.promise)
    await wrapper.get('[role="tab"]:last-child').trigger('click')
    await wrapper.get('[role="tab"]:first-child').trigger('click')
    await flushPromises()
    staleError.reject(new Error('stale'))
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Upcoming event')
  })

  it.each(['player', 'inactive', 'foreign', 'error'])(
    'does not offer creation with %s access',
    async (access) => {
      if (access === 'player') orgData.value.myMember.role = 'player'
      if (access === 'inactive') orgData.value.myMember.status = 'inactive'
      if (access === 'foreign') orgData.value.organization.id = 31
      if (access === 'error') orgError.value = new Error('forbidden')
      const wrapper = await renderEvents()
      expect(wrapper.find('.organizer-create-link').exists()).toBe(false)
    },
  )
})
