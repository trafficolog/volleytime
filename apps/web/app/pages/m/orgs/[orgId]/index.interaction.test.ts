// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onMounted, reactive, ref, Suspense, watch } from 'vue'

import Home from './index.vue'

const route = reactive({ params: { orgId: '30' } })
const orgData = ref({
  organization: { id: 30, name: 'Группа' },
  myMember: { role: 'owner', status: 'active' },
})
const dashData = ref({
  isManager: false,
  manager: null,
  myBookings: [
    {
      id: 5,
      status: 'confirmed',
      event: { id: 71, title: 'Чужая запись', startsAt: '2027-09-27T16:00:00Z', venue: null },
    },
  ],
  subscription: null,
  upcoming: [],
})
const refreshDash = vi.fn()
const orgError = ref<{ statusCode: number; data?: { code: string } } | null>(null)

vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
vi.stubGlobal('useFetch', (url: () => string) =>
  url().endsWith('/dashboard')
    ? { data: dashData, error: ref(null), status: ref('success'), refresh: refreshDash }
    : { data: orgData, error: orgError, status: ref('success'), refresh: vi.fn() },
)
vi.stubGlobal('computed', computed)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('watch', watch)
vi.stubGlobal('apiErrorStatus', (error: { statusCode: number }) => error.statusCode)
vi.stubGlobal('apiErrorCode', (error: { data?: { code: string } }) => error.data?.code)

afterEach(() => {
  document.body.innerHTML = ''
  refreshDash.mockClear()
  orgError.value = null
})

describe('organizer Home', () => {
  it('shows access denial without stale owner dashboard or invite action', async () => {
    orgError.value = { statusCode: 403, data: { code: 'permission.not_member' } }
    const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Home) }) })
    const wrapper = mount(host, {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: { template: '<header><slot name="right" /></header>' },
        },
      },
    })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Доступ к группе закрыт')
    expect(wrapper.text()).not.toContain('Обзор группы')
    expect(wrapper.text()).not.toContain('Чужая запись')
    expect(wrapper.find('a[href="/m/orgs/30/invite"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows an exclusive retryable error when owner membership conflicts with player dashboard', async () => {
    const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Home) }) })
    const wrapper = mount(host, {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: { template: '<header><slot name="right" /></header>' },
          VtIcon: { template: '<span />' },
          VtChip: { template: '<span><slot /></span>' },
          VtMeter: { template: '<span />' },
          OrganizerEventRow: { template: '<span />' },
          EventCard: { template: '<span />' },
          EmptyState: { template: '<span />' },
          SkeletonList: { template: '<div>Загрузка</div>' },
          ErrorState: {
            props: ['message'],
            emits: ['retry'],
            template:
              '<div role="alert">{{ message }}<button @click="$emit(\'retry\')">Повторить</button></div>',
          },
        },
      },
    })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось загрузить обзор группы')
    expect(wrapper.text()).not.toContain('Мои ближайшие записи')
    expect(wrapper.text()).not.toContain('Чужая запись')
    expect(wrapper.text()).not.toContain('Касса')
    await wrapper.get('[role="alert"] button').trigger('click')
    expect(refreshDash).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
