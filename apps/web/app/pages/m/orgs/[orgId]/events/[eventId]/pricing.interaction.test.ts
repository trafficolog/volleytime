// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file -- local test hosts mount the real pages */
import type { EventPricingView } from '@volley-time/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  Suspense,
  watch,
} from 'vue'

import Bookings from '../../bookings.vue'

import Page from './index.vue'

import EventCard from '~/components/EventCard.vue'

const route = reactive({ params: { orgId: '30', eventId: '71' }, fullPath: '/m/orgs/30/events/71' })
const pricing: EventPricingView = {
  mode: 'split',
  targetAmount: 10000,
  settledAt: null,
  participantCount: 3,
  minAmount: 3333,
  maxAmount: 3334,
  basis: 'current',
  myAllocatedAmount: null,
  myPaymentStatus: null,
}
const fixture = () => ({
  id: 71,
  organizationId: 30,
  title: 'Тренировка',
  status: 'published',
  startsAt: '2026-10-03T16:00:00Z',
  endsAt: '2026-10-03T18:00:00Z',
  capacity: 4,
  taken: 3,
  waitlist: 0,
  price: 0,
  currency: 'BYN',
  description: null,
  cancellationDeadlineHours: null as number | null,
  venue: null,
  locationText: null,
  pricing: { ...pricing },
  myBooking: null as null | {
    id: number
    status: string
    method: string
    paymentId: number | null
  },
})
let data = ref({
  event: fixture(),
  roster: [
    { user: { id: 9, name: 'Другой игрок', telegramUsername: null, image: null }, paid: true },
  ],
})
let error = ref<unknown>(null)
const org = ref({
  organization: { id: 30, subscriptionsEnabled: true },
  myMember: { organizationId: 30, role: 'player', status: 'active' },
})
const refresh = vi.fn()
const apiFetch = vi.fn(async (_url: string, _options?: { method?: string; body?: unknown }) => ({}))
const confirm = vi.fn(async () => true)
for (const [name, value] of Object.entries({
  computed,
  ref,
  watch,
  onMounted,
  onUnmounted,
  definePageMeta: () => undefined,
  useRoute: () => route,
  useOrgTimezone: () => ({ tz: 'Europe/Minsk' }),
  useTelegram: () => ({ confirm, haptic: vi.fn(), isTelegram: ref(false), useMainButton: vi.fn() }),
  $fetch: apiFetch,
  refreshNuxtData: vi.fn(),
  apiErrorCode: (e: { data?: { code?: string } } | null) => e?.data?.code,
  apiErrorStatus: () => 500,
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}))
  vi.stubGlobal(name, value)
vi.stubGlobal('useFetch', (url: () => string) => ({
  data: url().endsWith('/30') ? org : data,
  error: url().endsWith('/30') ? ref(null) : error,
  pending: ref(false),
  refresh,
}))

async function renderPage() {
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Page) }) }),
    {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: { template: '<header><slot name="right" /></header>' },
          VtChip: { template: '<span><slot /></span>' },
          VtIcon: true,
          VtMeter: true,
          VtAvatar: true,
          SkeletonList: true,
          VtSheet: {
            props: ['modelValue'],
            template: '<div v-if="modelValue" role="dialog"><slot /></div>',
          },
          ErrorState: {
            props: ['message'],
            emits: ['retry'],
            template:
              '<div role="alert">{{ message }}<button @click="$emit(\'retry\')">Повторить</button></div>',
          },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}
async function renderBookings() {
  route.fullPath = `/m/orgs/${route.params.orgId}/bookings`
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Bookings) }) }),
    {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: true,
          VtChip: { template: '<span><slot /></span>' },
          PlayerAccessNotice: true,
          SkeletonList: true,
          EmptyState: true,
          ErrorState: {
            props: ['message'],
            template: '<div role="alert">{{ message }}</div>',
          },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}
const cancellableBooking = () => ({
  id: 5,
  organizationId: 30,
  status: 'confirmed',
  pricing: { ...pricing },
  event: fixture(),
})
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))
  data = ref({
    event: fixture(),
    roster: [
      { user: { id: 9, name: 'Другой игрок', telegramUsername: null, image: null }, paid: true },
    ],
  })
  error = ref(null)
  route.params.orgId = '30'
  route.params.eventId = '71'
  route.fullPath = '/m/orgs/30/events/71'
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({})
  refresh.mockReset()
  confirm.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('player split pricing interactions', () => {
  it.each(['card', 'schedule'] as const)(
    'event %s shows server forecast and deferred booking status',
    async (presentation) => {
      const wrapper = mount(EventCard, {
        props: {
          event: { ...fixture(), myBooking: { id: 5, status: 'pending_payment' } },
          tz: 'Europe/Minsk',
          to: '/m/orgs/30/events/71',
          presentation,
        },
        global: {
          stubs: {
            NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
            VtChip: { template: '<span><slot /></span>' },
            VtMeter: true,
          },
        },
      })
      expect(wrapper.text()).toContain('≈ 33,33–33,34 BYN')
      expect(wrapper.text()).toContain('Прогноз')
      expect(wrapper.text()).toContain('Расчёт позже')
      expect(wrapper.text()).not.toContain('Бесплатно')
      expect(wrapper.find('a').attributes('href')).toBe('/m/orgs/30/events/71')
      wrapper.unmount()
    },
  )
  it.each(['card', 'schedule'] as const)(
    'event %s explains a zero-player capacity forecast',
    (presentation) => {
      const wrapper = mount(EventCard, {
        props: {
          event: {
            ...fixture(),
            taken: 0,
            pricing: {
              ...pricing,
              basis: 'capacity',
              participantCount: 4,
              minAmount: 2500,
              maxAmount: 2500,
            },
          },
          tz: 'Europe/Minsk',
          to: '/m/orgs/30/events/71',
          presentation,
        },
        global: {
          stubs: {
            NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
            VtChip: { template: '<span><slot /></span>' },
            VtMeter: true,
          },
        },
      })
      expect(wrapper.text()).toContain('≈ 25,00 BYN')
      expect(wrapper.text()).toContain('При полном составе')
      wrapper.unmount()
    },
  )
  it.each(['card', 'schedule'] as const)(
    'event %s says a split waitlist place has no charge',
    (presentation) => {
      const wrapper = mount(EventCard, {
        props: {
          event: { ...fixture(), taken: 4, myBooking: { id: 5, status: 'waitlisted' } },
          tz: 'Europe/Minsk',
          to: '/m/orgs/30/events/71',
          presentation,
        },
        global: {
          stubs: {
            NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
            VtChip: { template: '<span><slot /></span>' },
            VtMeter: true,
          },
        },
      })
      expect(wrapper.text()).toContain('Начисления нет')
      wrapper.unmount()
    },
  )
  it('my bookings keeps settled personal amount and removes cancellation', async () => {
    apiFetch.mockResolvedValueOnce({
      bookings: [
        {
          id: 5,
          organizationId: 30,
          status: 'confirmed',
          pricing: {
            ...pricing,
            basis: 'settled',
            settledAt: '2026-10-02T11:00:00Z',
            myAllocatedAmount: 3334,
            myPaymentStatus: 'refunded',
          },
          event: fixture(),
        },
      ],
    })
    const wrapper = mount(
      defineComponent({ render: () => h(Suspense, null, { default: () => h(Bookings) }) }),
      {
        global: {
          stubs: {
            NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
            VtMiniHeader: true,
            VtChip: { template: '<span><slot /></span>' },
            PlayerAccessNotice: true,
            SkeletonList: true,
            EmptyState: true,
            ErrorState: true,
          },
        },
      },
    )
    await flushPromises()
    expect(wrapper.text()).toContain('33,34 BYN')
    expect(wrapper.text()).toContain('Возвращено')
    expect(wrapper.text()).not.toContain('Оплачено')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Отменить запись')).toBe(false)
    wrapper.unmount()
  })
  it('my bookings retains a cancelled split booking with its settled refund', async () => {
    apiFetch.mockResolvedValueOnce({
      bookings: [
        {
          id: 5,
          organizationId: 30,
          status: 'cancelled',
          pricing: {
            ...pricing,
            basis: 'settled',
            settledAt: '2026-10-02T11:00:00Z',
            myAllocatedAmount: 3334,
            myPaymentStatus: 'refunded',
          },
          event: fixture(),
        },
        {
          id: 6,
          organizationId: 30,
          status: 'cancelled',
          pricing: {
            ...pricing,
            mode: 'fixed',
            basis: 'fixed',
            targetAmount: null,
            minAmount: 1500,
            maxAmount: 1500,
          },
          event: { ...fixture(), id: 72, title: 'Отменённый fixed' },
        },
        {
          id: 7,
          organizationId: 30,
          status: 'cancelled',
          pricing: { ...pricing },
          event: { ...fixture(), id: 73, title: 'Отменённый прогноз' },
        },
      ],
    })
    const wrapper = mount(
      defineComponent({ render: () => h(Suspense, null, { default: () => h(Bookings) }) }),
      {
        global: {
          stubs: {
            NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
            VtMiniHeader: true,
            VtChip: { template: '<span><slot /></span>' },
            PlayerAccessNotice: true,
            SkeletonList: true,
            EmptyState: true,
            ErrorState: true,
          },
        },
      },
    )
    await flushPromises()
    expect(wrapper.text()).toContain('33,34 BYN')
    expect(wrapper.text()).toContain('Возвращено')
    expect(wrapper.text()).not.toContain('Отменённый fixed')
    expect(wrapper.text()).not.toContain('Отменённый прогноз')
    expect(wrapper.findAll('button').some((button) => button.text() === 'Отменить запись')).toBe(
      false,
    )
    wrapper.unmount()
  })
  it('my bookings explains an unsettled reserved split place', async () => {
    apiFetch.mockResolvedValueOnce({
      bookings: [
        {
          id: 5,
          organizationId: 30,
          status: 'pending_payment',
          pricing: { ...pricing },
          event: fixture(),
        },
        {
          id: 6,
          organizationId: 30,
          status: 'waitlisted',
          pricing: { ...pricing },
          event: { ...fixture(), id: 72, taken: 4 },
        },
      ],
    })
    const wrapper = mount(
      defineComponent({ render: () => h(Suspense, null, { default: () => h(Bookings) }) }),
      {
        global: {
          stubs: {
            NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
            VtMiniHeader: true,
            VtChip: { template: '<span><slot /></span>' },
            PlayerAccessNotice: true,
            SkeletonList: true,
            EmptyState: true,
            ErrorState: true,
          },
        },
      },
    )
    await flushPromises()
    expect(wrapper.text()).toContain('≈ 33,33–33,34 BYN')
    expect(wrapper.text()).toContain('Прогноз')
    expect(wrapper.text()).toContain('Расчёт позже')
    expect(wrapper.text()).toContain('Начисления нет')
    expect(wrapper.text()).not.toContain('Бесплатно')
    wrapper.unmount()
  })
  it.each(['sibling route', 'unmount'] as const)(
    'my bookings aborts pending cancellation confirmation after %s',
    async (exit) => {
      apiFetch.mockResolvedValueOnce({ bookings: [cancellableBooking()] })
      let answer!: (value: boolean) => void
      confirm.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            answer = resolve
          }),
      )
      const wrapper = await renderBookings()
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Отменить запись')!
        .trigger('click')
      if (exit === 'sibling route') {
        route.fullPath = '/m/orgs/30/events'
      } else {
        wrapper.unmount()
      }
      answer(true)
      await flushPromises()
      expect(apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/cancel'))).toHaveLength(0)
      expect(
        apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/bookings/my')),
      ).toHaveLength(1)
      if (exit !== 'unmount') wrapper.unmount()
    },
  )
  it('my bookings rechecks a settled same-ID row after confirmation', async () => {
    apiFetch.mockResolvedValueOnce({ bookings: [cancellableBooking()] })
    let answer!: (value: boolean) => void
    confirm.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve
        }),
    )
    const wrapper = await renderBookings()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отменить запись')!
      .trigger('click')
    apiFetch.mockResolvedValueOnce({
      bookings: [
        {
          ...cancellableBooking(),
          pricing: { ...pricing, myAllocatedAmount: 3334, basis: 'settled' },
        },
      ],
    })
    const page = wrapper.findComponent(Bookings).vm as unknown as {
      $: { setupState: { load: () => Promise<void> } }
    }
    await page.$.setupState.load()
    await flushPromises()
    expect(wrapper.text()).toContain('33,34 BYN')
    answer(true)
    await flushPromises()
    expect(apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/cancel'))).toHaveLength(0)
    wrapper.unmount()
  })
  it('my bookings refreshes the row after a late server cancellation refusal', async () => {
    apiFetch.mockResolvedValueOnce({ bookings: [cancellableBooking()] })
    const wrapper = await renderBookings()
    apiFetch.mockRejectedValueOnce(new Error('booking.settled'))
    apiFetch.mockResolvedValueOnce({
      bookings: [
        {
          ...cancellableBooking(),
          pricing: { ...pricing, myAllocatedAmount: 3334, basis: 'settled' },
        },
      ],
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отменить запись')!
      .trigger('click')
    await flushPromises()
    expect(
      apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/bookings/my')),
    ).toHaveLength(2)
    expect(wrapper.text()).toContain('33,34 BYN')
    expect(wrapper.text()).not.toContain('≈')
    expect(wrapper.findAll('button').some((button) => button.text() === 'Отменить запись')).toBe(
      false,
    )
    wrapper.unmount()
  })
  it('my bookings does not refetch after a refusal on an abandoned route', async () => {
    apiFetch.mockResolvedValueOnce({ bookings: [cancellableBooking()] })
    const wrapper = await renderBookings()
    let refuse!: (error: Error) => void
    apiFetch.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          refuse = reject
        }),
    )
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отменить запись')!
      .trigger('click')
    route.fullPath = '/m/orgs/30/events'
    refuse(new Error('booking.settled'))
    await flushPromises()
    expect(
      apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/bookings/my')),
    ).toHaveLength(1)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it.each(['sibling route', 'leave and return'] as const)(
    'my bookings discards a refusal refresh held across %s',
    async (navigation) => {
      apiFetch.mockResolvedValueOnce({ bookings: [cancellableBooking()] })
      const wrapper = await renderBookings()
      apiFetch.mockRejectedValueOnce(new Error('booking.settled'))
      let finishRefresh!: (value: Record<string, unknown>) => void
      apiFetch.mockImplementationOnce(
        () =>
          new Promise<Record<string, unknown>>((resolve) => {
            finishRefresh = resolve
          }),
      )
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Отменить запись')!
        .trigger('click')
      await flushPromises()
      expect(
        apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/bookings/my')),
      ).toHaveLength(2)
      route.fullPath = '/m/orgs/30/events'
      await flushPromises()
      if (navigation === 'leave and return') {
        apiFetch.mockResolvedValueOnce({ bookings: [cancellableBooking()] })
        route.fullPath = '/m/orgs/30/bookings'
        await flushPromises()
      }
      finishRefresh({
        bookings: [
          {
            ...cancellableBooking(),
            pricing: {
              ...pricing,
              basis: 'settled',
              myAllocatedAmount: 3334,
              myPaymentStatus: 'refunded',
            },
          },
        ],
      })
      await flushPromises()
      expect(wrapper.text()).not.toContain('Возвращено')
      expect(
        apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/bookings/my')),
      ).toHaveLength(navigation === 'leave and return' ? 3 : 2)
      wrapper.unmount()
    },
  )
  it.each(['params first', 'path first', 'same tick'] as const)(
    'my bookings loads the destination organization when route updates %s',
    async (ordering) => {
      apiFetch.mockResolvedValueOnce({ bookings: [cancellableBooking()] })
      const wrapper = await renderBookings()
      try {
        let finishDestination!: (value: Record<string, unknown>) => void
        apiFetch.mockImplementationOnce(
          () =>
            new Promise<Record<string, unknown>>((resolve) => {
              finishDestination = resolve
            }),
        )
        if (ordering === 'path first') {
          route.fullPath = '/m/orgs/31/bookings'
          await flushPromises()
          route.params.orgId = '31'
        } else {
          route.params.orgId = '31'
          if (ordering === 'params first') await flushPromises()
          route.fullPath = '/m/orgs/31/bookings'
        }
        finishDestination({
          bookings: [
            {
              ...cancellableBooking(),
              organizationId: 31,
              event: { ...fixture(), organizationId: 31, title: 'Новая группа' },
            },
          ],
        })
        await flushPromises()
        expect(apiFetch.mock.calls.map(([url]) => url)).toEqual([
          '/api/organizations/30/bookings/my',
          '/api/organizations/31/bookings/my',
        ])
        expect(wrapper.text()).toContain('Новая группа')
        expect(wrapper.text()).not.toContain('Тренировка')
      } finally {
        wrapper.unmount()
      }
    },
  )
  it('my bookings ignores a late GET error after leaving the route', async () => {
    apiFetch.mockResolvedValueOnce({ bookings: [cancellableBooking()] })
    const wrapper = await renderBookings()
    let failRefresh!: (error: Error) => void
    apiFetch.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          failRefresh = reject
        }),
    )
    const page = wrapper.findComponent(Bookings).vm as unknown as {
      $: { setupState: { load: () => Promise<void> } }
    }
    const pending = page.$.setupState.load()
    route.fullPath = '/m/orgs/30/events'
    failRefresh(new Error('late GET failed'))
    await pending
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(
      apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/bookings/my')),
    ).toHaveLength(2)
    wrapper.unmount()
  })
  it.each(['?period=upcoming', '#top'] as const)(
    'my bookings aborts pending confirmation after fullPath %s change',
    async (suffix) => {
      apiFetch.mockResolvedValueOnce({ bookings: [cancellableBooking()] })
      let answer!: (value: boolean) => void
      confirm.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            answer = resolve
          }),
      )
      const wrapper = await renderBookings()
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Отменить запись')!
        .trigger('click')
      route.fullPath += suffix
      answer(true)
      await flushPromises()
      expect(apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/cancel'))).toHaveLength(0)
      expect(
        apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/bookings/my')),
      ).toHaveLength(1)
      wrapper.unmount()
    },
  )
  it('my bookings aborts pending confirmation after filter change', async () => {
    apiFetch.mockResolvedValueOnce({ bookings: [cancellableBooking()] })
    let answer!: (value: boolean) => void
    confirm.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve
        }),
    )
    const wrapper = await renderBookings()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отменить запись')!
      .trigger('click')
    apiFetch.mockResolvedValueOnce({ bookings: [] })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Прошедшие')!
      .trigger('click')
    answer(true)
    await flushPromises()
    expect(apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/cancel'))).toHaveLength(0)
    expect(
      apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/bookings/my')),
    ).toHaveLength(2)
    wrapper.unmount()
  })
  it.each(['cash', 'transfer'] as const)(
    'split_booking_allows_only_cash_or_transfer: %s reaches the API',
    async (method) => {
      refresh.mockImplementation(async () => {
        data.value.event.myBooking = { id: 5, status: 'pending_payment', method, paymentId: null }
      })
      const wrapper = await renderPage()
      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Записаться')!
        .trigger('click')
      await flushPromises()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      expect(wrapper.find('[role="dialog"]').text()).not.toContain('Абонемент')
      expect(apiFetch).not.toHaveBeenCalled()
      await wrapper
        .findAll('button')
        .find((b) => b.text().includes(method === 'cash' ? 'Наличными организатору' : 'Переводом'))!
        .trigger('click')
      await flushPromises()
      expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/events/71/bookings', {
        method: 'POST',
        body: { method },
      })
      expect(wrapper.find('[aria-label="Ваша запись"]').text()).toContain('Место забронировано')
      expect(wrapper.find('[aria-label="Ваша запись"]').text()).toContain(
        'Сумма после закрытия записи',
      )
      expect(wrapper.text()).not.toContain('Бесплатно')
      expect(wrapper.text()).not.toContain('Оплачено')
      wrapper.unmount()
    },
  )
  it('closes split payment choices when navigating from the event deep link', async () => {
    const wrapper = await renderPage()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Записаться')!
      .trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    route.fullPath = '/m/orgs/30/events/71/manage'
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(apiFetch).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('does not cancel an old event after navigating during confirmation', async () => {
    data.value.event.myBooking = {
      id: 5,
      status: 'pending_payment',
      method: 'cash',
      paymentId: null,
    }
    let answer!: (value: boolean) => void
    confirm.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve
        }),
    )
    const wrapper = await renderPage()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отменить запись')!
      .trigger('click')
    route.fullPath = '/m/orgs/30/events/71/manage'
    answer(true)
    await flushPromises()
    expect(apiFetch).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('unsettled_split_is_not_free_or_paid and roster does not reveal other payments', async () => {
    const wrapper = await renderPage()
    expect(wrapper.text()).toContain('≈ 33,33–33,34 BYN')
    expect(wrapper.text()).toContain('Прогноз')
    expect(wrapper.text()).not.toContain('Бесплатно')
    expect(wrapper.text()).not.toContain('Оплачено')
    data.value.event.pricing = {
      ...pricing,
      basis: 'capacity',
      minAmount: 2500,
      maxAmount: 2500,
      participantCount: 4,
    }
    data.value.event.taken = 0
    await flushPromises()
    expect(wrapper.text()).toContain('При полном составе')
    wrapper.unmount()
  })
  it.each(['pending', 'succeeded', 'cancelled', 'refunded'] as const)(
    'settled own amount remains exact and payment %s is explicit',
    async (status) => {
      data.value.event.pricing = {
        ...pricing,
        basis: 'settled',
        settledAt: '2026-10-02T11:00:00Z',
        myAllocatedAmount: 3334,
        myPaymentStatus: status,
      }
      data.value.event.myBooking = { id: 5, status: 'confirmed', method: 'cash', paymentId: 11 }
      const wrapper = await renderPage()
      const own = wrapper.find('[aria-label="Ваша запись"]').text()
      expect(own).toContain('33,34 BYN')
      expect(own).toContain(
        {
          pending: 'Ждёт оплаты',
          succeeded: 'Оплачено',
          cancelled: 'Платёж отменён',
          refunded: 'Возвращено',
        }[status],
      )
      expect(own).not.toContain('≈')
      expect(wrapper.findAll('button').some((b) => b.text() === 'Отменить запись')).toBe(false)
      if (status !== 'succeeded') expect(wrapper.text()).not.toContain('Оплачено')
      wrapper.unmount()
    },
  )
  it('waitlist has no charge and keeps only supported methods', async () => {
    data.value.event.myBooking = {
      id: 5,
      status: 'waitlisted',
      method: 'transfer',
      paymentId: null,
    }
    const wrapper = await renderPage()
    expect(wrapper.find('[aria-label="Ваша запись"]').text()).toContain('Начисления нет')
    expect(wrapper.text()).not.toContain('Оплачено')
    wrapper.unmount()
  })
  it('settled waitlist after cancellation deadline does not claim an allocated share', async () => {
    data.value.event.startsAt = '2026-10-03T16:00:00Z'
    data.value.event.cancellationDeadlineHours = 48
    data.value.event.pricing = {
      ...pricing,
      basis: 'settled',
      settledAt: '2026-10-02T11:00:00Z',
      myAllocatedAmount: null,
    }
    data.value.event.myBooking = {
      id: 5,
      status: 'waitlisted',
      method: 'transfer',
      paymentId: null,
    }
    const wrapper = await renderPage()
    const own = wrapper.find('[aria-label="Ваша запись"]').text()
    expect(own).toContain('Начисления нет')
    expect(own).toContain('Дедлайн отмены прошёл')
    expect(own).not.toContain('Доля зафиксирована')
    wrapper.unmount()
  })
  it('fixed free booking still submits free directly', async () => {
    data.value.event.pricing = {
      ...pricing,
      mode: 'fixed',
      basis: 'fixed',
      targetAmount: null,
      minAmount: 0,
      maxAmount: 0,
    }
    const wrapper = await renderPage()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Записаться')!
      .trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/events/71/bookings', {
      method: 'POST',
      body: { method: 'free' },
    })
    wrapper.unmount()
  })
})
