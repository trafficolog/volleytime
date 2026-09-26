// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense } from 'vue'

import EditEvent from './[eventId]/edit.vue'
import NewEvent from './new.vue'

const route = reactive({ params: { orgId: '30', eventId: '71' } })
const orgData = ref({
  organization: { id: 30, defaultTimezone: 'Europe/Minsk', subscriptionsEnabled: false },
  myMember: { role: 'organizer', status: 'active' },
})
const orgError = ref<Error | null>(null)
const orgStatus = ref('success')
const evData = ref({ event: { id: 71, organizationId: 30, status: 'draft' } })
const evError = ref<Error | null>(null)
const evStatus = ref('success')
const navigateTo = vi.fn()

vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk'), load: async () => undefined }))
vi.stubGlobal('computed', computed)
vi.stubGlobal('useFetch', (url: () => string) =>
  url().includes('/events/')
    ? { data: evData, error: evError, status: evStatus }
    : { data: orgData, error: orgError, status: orgStatus },
)

async function renderPage(component: typeof NewEvent | typeof EditEvent) {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(component) }) })
  const wrapper = mount(host, {
    global: {
      mocks: { navigateTo },
      stubs: {
        VtMiniHeader: { template: '<header />' },
        EventForm: {
          name: 'EventForm',
          props: { orgId: Number, subscriptionsEnabled: Boolean },
          template:
            '<form data-testid="event-form" :data-org="orgId" :data-subs="subscriptionsEnabled" />',
        },
        ErrorState: { props: ['message'], template: '<p role="alert">{{ message }}</p>' },
        EmptyState: { props: ['title'], template: '<p>{{ title }}</p>' },
        SkeletonList: { template: '<p>Loading</p>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  navigateTo.mockReset()
  route.params.orgId = '30'
  route.params.eventId = '71'
  orgData.value = {
    organization: { id: 30, defaultTimezone: 'Europe/Minsk', subscriptionsEnabled: false },
    myMember: { role: 'organizer', status: 'active' },
  }
  orgError.value = null
  orgStatus.value = 'success'
  evData.value = { event: { id: 71, organizationId: 30, status: 'draft' } }
  evError.value = null
  evStatus.value = 'success'
})

describe('event form route access', () => {
  it('passes the selected organization setting and removes the new form on route switch', async () => {
    const wrapper = await renderPage(NewEvent)
    expect(wrapper.get('[data-testid="event-form"]').attributes('data-subs')).toBe('false')
    route.params.orgId = '31'
    await flushPromises()
    expect(wrapper.find('[data-testid="event-form"]').exists()).toBe(false)
  })

  it('keeps edit closed for a player, an event from another group, and load failure', async () => {
    orgData.value.myMember = { role: 'player', status: 'active' }
    const wrapper = await renderPage(EditEvent)
    expect(wrapper.find('[data-testid="event-form"]').exists()).toBe(false)
    orgData.value.myMember = { role: 'owner', status: 'active' }
    evData.value = { event: { id: 71, organizationId: 31, status: 'draft' } }
    await flushPromises()
    expect(wrapper.find('[data-testid="event-form"]').exists()).toBe(false)
    evData.value = { event: { id: 71, organizationId: 30, status: 'draft' } }
    evError.value = new Error('forbidden')
    await flushPromises()
    expect(wrapper.find('[data-testid="event-form"]').exists()).toBe(false)
  })

  it('does not navigate from a completed create after the organization changes', async () => {
    const wrapper = await renderPage(NewEvent)
    const form = wrapper.getComponent({ name: 'EventForm' })
    route.params.orgId = '31'
    form.vm.$emit('saved', { id: 71, organizationId: 30 })
    await flushPromises()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('does not navigate from a completed edit after the event changes', async () => {
    const wrapper = await renderPage(EditEvent)
    const form = wrapper.getComponent({ name: 'EventForm' })
    route.params.eventId = '72'
    form.vm.$emit('saved', { id: 71, organizationId: 30 })
    await flushPromises()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('navigates to the saved event when the create and edit routes are still current', async () => {
    const created = await renderPage(NewEvent)
    created.getComponent({ name: 'EventForm' }).vm.$emit('saved', { id: 72, organizationId: 30 })
    expect(navigateTo).toHaveBeenCalledWith('/m/orgs/30/events/72')
    navigateTo.mockClear()
    const edited = await renderPage(EditEvent)
    edited.getComponent({ name: 'EventForm' }).vm.$emit('saved', { id: 71, organizationId: 30 })
    expect(navigateTo).toHaveBeenCalledWith('/m/orgs/30/events/71/manage')
  })
})
