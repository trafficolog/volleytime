// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  onMounted,
  reactive,
  ref,
  shallowRef,
  Suspense,
  watch,
} from 'vue'

import { apiErrorMessage } from '~/utils/api-error'

import Home from './index.vue'

const HomeHost = defineComponent({ render: () => h(Suspense, null, { default: () => h(Home) }) })

const route = reactive({ params: { orgId: '30' } })
const orgData = ref({
  organization: {
    id: 30,
    name: 'Группа',
    city: 'Минск',
    status: 'active',
    subscriptionsEnabled: true,
  },
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
const fetchDashboard = vi.fn<() => Promise<unknown>>(async () => dashData.value)
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
vi.stubGlobal('ref', ref)
vi.stubGlobal('shallowRef', shallowRef)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('watch', watch)
vi.stubGlobal('$fetch', fetchDashboard)
vi.stubGlobal('useOrganizations', () => ({
  orgs: ref([]),
  loading: ref(false),
  fetchAll: vi.fn(),
  selectOrg: vi.fn(),
}))
vi.stubGlobal('apiErrorStatus', (error: { statusCode: number }) => error.statusCode)
vi.stubGlobal('apiErrorCode', (error: { data?: { code: string } } | null) => error?.data?.code)
vi.stubGlobal('apiErrorMessage', apiErrorMessage)

afterEach(() => {
  document.body.innerHTML = ''
  refreshDash.mockClear()
  fetchDashboard.mockClear()
  orgError.value = null
  orgData.value.myMember.role = 'owner'
})

describe('organizer Home', () => {
  it('shows the server retry message for a transient player dashboard error', async () => {
    orgData.value.myMember.role = 'player'
    fetchDashboard.mockRejectedValueOnce({
      statusCode: 503,
      data: { statusMessage: 'Временная ошибка сервера' },
    })
    const wrapper = mount(HomeHost, {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: { template: '<header><slot name="right" /></header>' },
          VtSheet: { template: '<div />' },
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
    expect(wrapper.get('[role="alert"]').text()).toContain('Временная ошибка сервера')
    expect(wrapper.text()).not.toContain('Чужая запись')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(fetchDashboard).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
  it('keeps the organizer cash bento and management route without player hero', async () => {
    fetchDashboard.mockImplementationOnce(async () => ({
      isManager: true,
      myBookings: [],
      subscription: null,
      manager: {
        pendingCount: 2,
        pendingAmount: 2500,
        balance: { currency: 'BYN', income: 5000, expense: 1000, balance: 4000, byCurrency: {} },
      },
      upcoming: [
        {
          id: 74,
          title: 'Игра организатора',
          status: 'published',
          startsAt: '2027-10-01T16:00:00Z',
          endsAt: '2027-10-01T18:00:00Z',
          capacity: 12,
          taken: 2,
          price: 10,
          currency: 'BYN',
          waitlist: 0,
          myBooking: null,
          venue: { name: 'Зал' },
          locationText: null,
        },
      ],
    }))
    const wrapper = mount(HomeHost, {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: { template: '<header><slot name="right" /></header>' },
          VtSheet: { template: '<div />' },
          VtIcon: { template: '<span />' },
          VtChip: { template: '<span><slot /></span>' },
          VtMeter: { template: '<span />' },
          EventCard: { template: '<span />' },
          EmptyState: { template: '<span />' },
          SkeletonList: { template: '<span />' },
          ErrorState: { template: '<span />' },
          OrganizerEventRow: {
            props: ['event', 'to'],
            template: '<a :href="to">{{ event.title }}</a>',
          },
        },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('40,00 BYN')
    expect(wrapper.text()).toContain('Игра организатора')
    expect(wrapper.find('a[href="/m/orgs/30/events/74/manage"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/m/orgs/30/events/74"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Ближайшая игра')
    wrapper.unmount()
  })
  it('keeps the player hero and flat schedule without organizer actions', async () => {
    orgData.value.myMember.role = 'player'
    fetchDashboard.mockImplementationOnce(async () => ({
      isManager: false,
      manager: null,
      myBookings: [],
      subscription: null,
      upcoming: [
        {
          id: 72,
          title: 'Первая игра',
          status: 'published',
          startsAt: '2027-09-28T16:00:00Z',
          endsAt: '2027-09-28T18:00:00Z',
          capacity: 12,
          taken: 2,
          price: 10,
          currency: 'BYN',
          waitlist: 0,
          myBooking: null,
          venue: { name: 'Зал' },
          locationText: null,
        },
        {
          id: 73,
          title: 'Вторая игра',
          status: 'published',
          startsAt: '2027-09-30T16:00:00Z',
          endsAt: '2027-09-30T18:00:00Z',
          capacity: 12,
          taken: 1,
          price: 10,
          currency: 'BYN',
          waitlist: 0,
          myBooking: null,
          venue: { name: 'Зал' },
          locationText: null,
        },
      ],
    }))
    const wrapper = mount(HomeHost, {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: { template: '<header><slot name="right" /></header>' },
          VtSheet: { template: '<div />' },
          VtIcon: { template: '<span />' },
          VtChip: { template: '<span><slot /></span>' },
          EventCard: { props: ['event', 'to'], template: '<a :href="to">{{ event.title }}</a>' },
          EmptyState: { template: '<span />' },
        },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Первая игра')
    expect(wrapper.text()).toContain('Вторая игра')
    expect(wrapper.find('a[href="/m/orgs/30/events/73"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Обзор организатора')
    expect(wrapper.find('a[href="/m/orgs/30/cashbox"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('shows access denial without stale owner dashboard or invite action', async () => {
    orgError.value = { statusCode: 403, data: { code: 'permission.not_member' } }
    const wrapper = mount(HomeHost, {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: { template: '<header><slot name="right" /></header>' },
          VtSheet: { template: '<div />' },
        },
      },
    })
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Доступ в группу закрыт')
    expect(wrapper.text()).not.toContain('Обзор группы')
    expect(wrapper.text()).not.toContain('Чужая запись')
    expect(wrapper.find('a[href="/m/orgs/30/invite"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows an exclusive retryable error when owner membership conflicts with player dashboard', async () => {
    const wrapper = mount(HomeHost, {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: { template: '<header><slot name="right" /></header>' },
          VtSheet: { template: '<div />' },
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
    expect(fetchDashboard).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
