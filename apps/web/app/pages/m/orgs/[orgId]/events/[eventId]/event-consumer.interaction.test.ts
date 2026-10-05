// @vitest-environment happy-dom
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

import Page from './index.vue'

const path = '/m/orgs/30/events/71'
const route = reactive({ params: { orgId: '30', eventId: '71' }, fullPath: path })
const fixture = () => ({
  id: 71,
  organizationId: 30,
  title: 'Тренировка',
  status: 'published',
  startsAt: '2027-10-03T16:00:00Z',
  endsAt: '2027-10-03T18:00:00Z',
  capacity: 4,
  taken: 3,
  waitlist: 0,
  price: 0,
  currency: 'BYN',
  description: null,
  cancellationDeadlineHours: null as number | null,
  venue: null,
  locationText: null,
  pricing: {
    mode: 'split',
    targetAmount: 10000,
    settledAt: null,
    participantCount: 3,
    minAmount: 3333,
    maxAmount: 3334,
    basis: 'current',
    myAllocatedAmount: null,
    myPaymentStatus: null,
  } as EventPricingView,
  myBooking: { id: 5, status: 'pending_payment', method: 'cash', paymentId: null } as null | {
    id: number
    status: string
    method: string
    paymentId: number | null
  },
})
let data = ref({ event: fixture(), roster: [] })
const refresh = vi.fn(async () => undefined)
const refreshOther = vi.fn(async () => undefined)
const post = vi.fn(async (_url: string, _opts?: { method?: string; body?: unknown }) => ({}))
const confirm = vi.fn(async () => true)
const haptic = vi.fn()
let wrapper: Awaited<ReturnType<typeof render>> | undefined

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
async function render() {
  const mounted = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Page) }) }),
    {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: true,
          VtChip: { template: '<span><slot /></span>' },
          VtIcon: true,
          VtMeter: true,
          VtAvatar: true,
          SkeletonList: true,
          VtSheet: {
            props: ['modelValue'],
            template: '<div v-if="modelValue" role="dialog"><slot /></div>',
          },
          ErrorState: { props: ['message'], template: '<div role="alert">{{ message }}</div>' },
        },
      },
    },
  )
  await flushPromises()
  return mounted
}
const button = (label: string) =>
  wrapper!.findAll('button').find((b) => b.text().startsWith(label))!
const settleLatest = () => {
  data.value.event.pricing = {
    ...data.value.event.pricing,
    basis: 'settled',
    settledAt: '2026-10-04T09:00:00Z',
    myAllocatedAmount: 3334,
    myPaymentStatus: 'pending',
  }
  data.value.event.status = 'closed'
}
beforeEach(() => {
  data = ref({ event: fixture(), roster: [] })
  route.params = { orgId: '30', eventId: '71' }
  route.fullPath = path
  refresh.mockReset().mockResolvedValue(undefined)
  refreshOther.mockClear()
  post.mockReset().mockResolvedValue({})
  confirm.mockReset().mockResolvedValue(true)
  haptic.mockClear()
  Object.entries({
    computed,
    ref,
    watch,
    onMounted,
    onUnmounted,
    definePageMeta: () => undefined,
    useRoute: () => route,
    useOrgTimezone: () => ({ tz: 'Europe/Minsk' }),
    useTelegram: () => ({ confirm, haptic, isTelegram: ref(false), useMainButton: vi.fn() }),
    $fetch: post,
    refreshNuxtData: refreshOther,
    apiErrorCode: (error: { data?: { code?: string } } | null) => error?.data?.code,
    apiErrorStatus: () => 500,
    apiErrorMessage: (_error: unknown, fallback: string) => fallback,
    useFetch: (url: () => string) => ({
      data: url().endsWith('/30')
        ? ref({
            organization: { id: 30, subscriptionsEnabled: true },
            myMember: { organizationId: 30, role: 'player', status: 'active' },
          })
        : data,
      error: ref(null),
      pending: ref(false),
      refresh,
    }),
  }).forEach(([name, value]) => vi.stubGlobal(name, value))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('isolated real player event consumer: action ownership and confirmation lifetime', () => {
  for (const action of ['cancel', 'booking'] as const) {
    for (const suffix of ['?view=roster', '#roster']) {
      it.each(['success', 'refusal'] as const)(
        `${action} held POST retains busy/result on ${suffix}: %s`,
        async (outcome) => {
          if (action === 'booking') data.value.event.myBooking = null
          wrapper = await render()
          const pending = deferred<Record<string, unknown>>()
          post.mockImplementationOnce(() => pending.promise)
          if (action === 'booking') {
            await button('Записаться').trigger('click')
            await button('Наличными').trigger('click')
          } else await button('Отменить запись').trigger('click')
          expect(post).toHaveBeenCalledOnce()
          route.fullPath = `${path}${suffix}`
          await flushPromises()
          if (action === 'cancel') {
            expect(button('Отменить запись').attributes('disabled')).toBeDefined()
            await button('Отменить запись').trigger('click')
          } else await button('Записаться').trigger('click')
          expect(post).toHaveBeenCalledOnce()
          if (outcome === 'success') pending.resolve({})
          else {
            refresh.mockImplementationOnce(async () => {
              settleLatest()
            })
            pending.reject({
              statusCode: 409,
              data: {
                code:
                  action === 'cancel' ? 'booking.not_cancellable' : 'booking.event_not_bookable',
              },
            })
          }
          await flushPromises()
          expect(refresh).toHaveBeenCalledOnce()
          expect(haptic).toHaveBeenCalledWith(outcome === 'success' ? 'success' : 'error')
          if (outcome === 'refusal') {
            expect(wrapper.text()).toContain(
              action === 'cancel' ? 'Не удалось отменить запись' : 'Не удалось записаться',
            )
            expect(wrapper.text()).toContain('33,34')
          }
        },
      )
    }
    it.each(['leave-return', 'unmount'] as const)(
      `${action} sent POST suppresses late refusal after %s`,
      async (departure) => {
        if (action === 'booking') data.value.event.myBooking = null
        wrapper = await render()
        const pending = deferred<Record<string, unknown>>()
        post.mockImplementationOnce(() => pending.promise)
        if (action === 'booking') {
          await button('Записаться').trigger('click')
          await button('Наличными').trigger('click')
        } else await button('Отменить запись').trigger('click')
        if (departure === 'unmount') wrapper.unmount()
        else {
          route.fullPath = '/m/orgs/30/events'
          route.fullPath = path
        }
        pending.reject({ statusCode: 409, data: { code: 'booking.not_cancellable' } })
        await flushPromises()
        expect(refresh).not.toHaveBeenCalled()
        expect(refreshOther).not.toHaveBeenCalled()
        expect(haptic).not.toHaveBeenCalled()
      },
    )
  }
  it.each(['query', 'hash', 'leave-return', 'unmount', 'latest-no-cancel', 'latest-row'] as const)(
    'pending confirmation never posts after %s',
    async (change) => {
      wrapper = await render()
      const pending = deferred<boolean>()
      confirm.mockImplementationOnce(() => pending.promise)
      await button('Отменить запись').trigger('click')
      if (change === 'query') route.fullPath = `${path}?view=roster`
      if (change === 'hash') route.fullPath = `${path}#roster`
      if (change === 'leave-return') {
        route.fullPath = '/m/orgs/30/events'
        route.fullPath = path
      }
      if (change === 'unmount') wrapper.unmount()
      if (change === 'latest-no-cancel') settleLatest()
      if (change === 'latest-row') data.value.event.myBooking!.id = 6
      pending.resolve(true)
      await flushPromises()
      expect(post).not.toHaveBeenCalled()
      expect(refresh).not.toHaveBeenCalled()
    },
  )
  it('only the latest confirmation owns one POST and an in-flight action rejects another confirmation', async () => {
    wrapper = await render()
    const first = deferred<boolean>()
    const second = deferred<boolean>()
    const sent = deferred<Record<string, unknown>>()
    confirm.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)
    post.mockImplementationOnce(() => sent.promise)
    await button('Отменить запись').trigger('click')
    await button('Отменить запись').trigger('click')
    second.resolve(true)
    await flushPromises()
    first.resolve(true)
    await flushPromises()
    expect(post).toHaveBeenCalledOnce()
    sent.resolve({})
    await flushPromises()
    expect(refresh).toHaveBeenCalledOnce()
  })
  it('cancelled empty roster does not invite a new booking', async () => {
    data.value.event.status = 'cancelled'
    data.value.event.myBooking = null
    wrapper = await render()
    expect(wrapper.text()).toContain('Событие отменено')
    expect(wrapper.text()).not.toContain('будьте первым')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Записаться')).toBe(false)
  })
})
