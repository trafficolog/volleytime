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
  watchEffect,
} from 'vue'

import Page from './index.vue'

import BookingSeatsStepper from '~/components/BookingSeatsStepper.vue'
import PlayerBookingForm from '~/components/PlayerBookingForm.vue'
import PlayerSeatsCancel from '~/components/PlayerSeatsCancel.vue'
import PlayerSplitPriceCard from '~/components/PlayerSplitPriceCard.vue'
import WaitlistOfferCard from '~/components/WaitlistOfferCard.vue'
import MyChip from '~/components/vt/MyChip.vue'
import SeatsMini from '~/components/vt/SeatsMini.vue'
import StateChip from '~/components/vt/StateChip.vue'
import Toggle from '~/components/vt/Toggle.vue'
import { withSplitPriceFetch } from '~/utils/__fixtures__/split-quote'
import { apiErrorCode, apiErrorMessage, apiErrorStatus } from '~/utils/api-error'

const levelsCatalog = [
  { code: 'v1', title: 'В1', description: 'Полупрофи', sortOrder: 1 },
  { code: 'v2', title: 'В2', description: 'Сильный любитель', sortOrder: 2 },
]
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
  cancellationAllowed: true,
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
type RosterFixture = {
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
  paid: boolean
  level?: string | null
}
let data = ref({ event: fixture(), roster: [] as RosterFixture[] })
let eventError = ref<unknown>(null)
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
          PlayerBookingForm,
          PlayerSeatsCancel,
          PlayerSplitPriceCard,
          WaitlistOfferCard,
          BookingSeatsStepper,
          VtToggle: Toggle,
          VtMyChip: MyChip,
          VtStateChip: StateChip,
          VtSeatsMini: SeatsMini,
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
/** Лист записи: способ по умолчанию — первый (наличные), затем кнопка записи (20.4.5). */
const submitInSheet = () =>
  wrapper!
    .get('[role="dialog"]')
    .findAll('button')
    .find((b) => b.text().startsWith('Записаться'))!
    .trigger('click')
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
  data = ref({ event: fixture(), roster: [] as RosterFixture[] })
  eventError = ref(null)
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
    watchEffect,
    createMainButton: () => ({ update: vi.fn(), destroy: vi.fn() }),
    definePageMeta: () => undefined,
    useRoute: () => route,
    useOrgTimezone: () => ({ tz: 'Europe/Minsk' }),
    useTelegram: () => ({ confirm, haptic, isTelegram: ref(false), useMainButton: vi.fn() }),
    $fetch: withSplitPriceFetch(post, () => data.value.event),
    refreshNuxtData: refreshOther,
    apiErrorCode: (error: { data?: { code?: string } } | null) => error?.data?.code,
    apiErrorStatus: () => 500,
    apiErrorMessage: (_error: unknown, fallback: string) => fallback,
    useFetch: (url: string | (() => string)) => {
      const path = typeof url === 'function' ? url() : url
      if (path === '/api/levels') {
        return { data: ref({ levels: levelsCatalog }), error: ref(null), pending: ref(false) }
      }
      return {
        data: path.endsWith('/30')
          ? ref({
              organization: { id: 30, subscriptionsEnabled: true },
              myMember: { organizationId: 30, role: 'player', status: 'active' },
            })
          : data,
        error: path.endsWith('/30') ? ref(null) : eventError,
        pending: ref(false),
        refresh,
      }
    },
  }).forEach(([name, value]) => vi.stubGlobal(name, value))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe.each([path, `${path}/`])(
  'isolated real player event consumer at %s: action ownership and confirmation lifetime',
  (eventPath) => {
    beforeEach(() => {
      route.fullPath = eventPath
    })
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
              await submitInSheet()
            } else await button('Отменить запись').trigger('click')
            expect(post).toHaveBeenCalledExactlyOnceWith(
              action === 'cancel'
                ? '/api/organizations/30/bookings/5/cancel'
                : '/api/organizations/30/events/71/bookings',
              action === 'cancel'
                ? { method: 'POST' }
                : { method: 'POST', body: { method: 'cash' } },
            )
            route.fullPath = `${eventPath}${suffix}`
            await flushPromises()
            const actionButton = button(action === 'cancel' ? 'Отменить запись' : 'Записаться')
            expect(actionButton.attributes('disabled')).toBeDefined()
            await actionButton.trigger('click')
            expect(post).toHaveBeenCalledOnce()
            const fetched = deferred<undefined>()
            if (outcome === 'success') pending.resolve({})
            else {
              refresh.mockImplementationOnce(() => fetched.promise)
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
            if (outcome === 'refusal') {
              expect(actionButton.attributes('disabled')).toBeDefined()
              await actionButton.trigger('click')
              expect(post).toHaveBeenCalledOnce()
              settleLatest()
              fetched.resolve(undefined)
              await flushPromises()
            }
            expect(haptic).toHaveBeenCalledWith(outcome === 'success' ? 'success' : 'error')
            if (outcome === 'refusal') {
              expect(wrapper.text()).toContain(
                action === 'cancel' ? 'Не удалось отменить запись' : 'Не удалось записаться',
              )
              expect(wrapper.text()).toContain('33,34')
            } else {
              expect(actionButton.attributes('disabled')).toBeUndefined()
              expect(wrapper.text()).not.toContain('Не удалось')
              expect(refreshOther).toHaveBeenCalledExactlyOnceWith('org-nav-balances-30')
            }
          },
        )
      }
      for (const outcome of ['success', 'refusal'] as const) {
        it.each(['leave-return', 'unmount', 'edit', 'other-event', 'other-org'] as const)(
          `${action} sent POST suppresses late ${outcome} after %s`,
          async (departure) => {
            if (action === 'booking') data.value.event.myBooking = null
            wrapper = await render()
            const pending = deferred<Record<string, unknown>>()
            post.mockImplementationOnce(() => pending.promise)
            if (action === 'booking') {
              await button('Записаться').trigger('click')
              await submitInSheet()
            } else await button('Отменить запись').trigger('click')
            if (departure === 'unmount') wrapper.unmount()
            else if (departure === 'leave-return') {
              route.fullPath = '/m/orgs/30/events'
              route.fullPath = eventPath
            } else if (departure === 'edit') route.fullPath = `${path}/edit`
            else if (departure === 'other-event') {
              route.params.eventId = '72'
              route.fullPath = '/m/orgs/30/events/72'
            } else {
              route.params.orgId = '31'
              route.fullPath = '/m/orgs/31/events/71'
            }
            if (outcome === 'success') pending.resolve({})
            else pending.reject({ statusCode: 409, data: { code: 'booking.not_cancellable' } })
            await flushPromises()
            expect(refresh).not.toHaveBeenCalled()
            expect(refreshOther).not.toHaveBeenCalled()
            expect(haptic).not.toHaveBeenCalled()
            expect(wrapper.text()).not.toContain('Не удалось')
            expect(post).toHaveBeenCalledOnce()
          },
        )
      }
    }
    it.each([
      'query',
      'hash',
      'leave-return',
      'unmount',
      'latest-no-cancel',
      'latest-row',
    ] as const)('pending confirmation never posts after %s', async (change) => {
      wrapper = await render()
      const pending = deferred<boolean>()
      confirm.mockImplementationOnce(() => pending.promise)
      await button('Отменить запись').trigger('click')
      if (change === 'query') route.fullPath = `${eventPath}?view=roster`
      if (change === 'hash') route.fullPath = `${eventPath}#roster`
      if (change === 'leave-return') {
        route.fullPath = '/m/orgs/30/events'
        route.fullPath = eventPath
      }
      if (change === 'unmount') wrapper.unmount()
      if (change === 'latest-no-cancel') settleLatest()
      if (change === 'latest-row') data.value.event.myBooking!.id = 6
      pending.resolve(true)
      await flushPromises()
      expect(post).not.toHaveBeenCalled()
      expect(refresh).not.toHaveBeenCalled()
    })
    it('only the latest confirmation owns one POST and an in-flight action rejects another confirmation', async () => {
      wrapper = await render()
      const first = deferred<boolean>()
      const second = deferred<boolean>()
      const sent = deferred<Record<string, unknown>>()
      confirm
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise)
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
  },
)

describe('booking rejected because the event is gone (19.3.1)', () => {
  it('404 event.not_found refreshes the page into the unavailable state, not a generic failure', async () => {
    Object.entries({ apiErrorCode, apiErrorMessage, apiErrorStatus }).forEach(([name, value]) =>
      vi.stubGlobal(name, value),
    )
    data.value.event.myBooking = null
    const notFound = { statusCode: 404, data: { data: { code: 'event.not_found' } } }
    post.mockRejectedValueOnce(notFound)
    refresh.mockImplementationOnce(async () => {
      eventError.value = notFound
    })
    wrapper = await render()
    await button('Записаться').trigger('click')
    await submitInSheet()
    await flushPromises()
    expect(post).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
    expect(haptic).toHaveBeenCalledWith('error')
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Событие не найдено. Событие больше недоступно.',
    )
    expect(wrapper.text()).not.toContain('Не удалось записаться')
    expect(wrapper.find('a[href="/m/orgs/30/events"]').exists()).toBe(true)
  })
})

describe('self-cancellation policy, deadline and partial seats (20.4.8)', () => {
  it('hides the cancel button and explains it when the group policy forbids self-cancel (D-02)', async () => {
    data.value.event.cancellationAllowed = false
    data.value.event.cancellationDeadlineHours = null
    wrapper = await render()
    expect(wrapper.findAll('button').some((b) => b.text().startsWith('Отменить запись'))).toBe(
      false,
    )
    expect(wrapper.text()).toContain('Самостоятельная отмена недоступна')
  })

  it('shows «Отменить можно до …» next to the booking while cancellation is open', async () => {
    data.value.event.cancellationAllowed = true
    data.value.event.cancellationDeadlineHours = 12
    wrapper = await render()
    expect(wrapper.text()).toContain('Отменить можно до')
  })

  describe('caption «Занятие вернётся на абонемент»', () => {
    const subscriptionBooking = (over: Record<string, unknown> = {}) => {
      data.value.event.cancellationAllowed = true
      data.value.event.cancellationDeadlineHours = null
      data.value.event.price = 5000
      data.value.event.pricing = { ...data.value.event.pricing, mode: 'fixed' }
      data.value.event.myBooking = {
        id: 5,
        status: 'confirmed',
        method: 'subscription',
        paymentId: null,
        seats: 1,
        waitlistSeats: 0,
        ...over,
      } as unknown as typeof data.value.event.myBooking
    }

    it('is shown under the cancel button for a confirmed subscription booking', async () => {
      subscriptionBooking()
      wrapper = await render()
      expect(wrapper.text()).toContain('Занятие вернётся на абонемент')
    })

    it('is not shown when the policy forbids cancelling or the deadline has passed', async () => {
      subscriptionBooking()
      data.value.event.cancellationAllowed = false
      wrapper = await render()
      expect(wrapper.text()).not.toContain('Занятие вернётся на абонемент')
      wrapper.unmount()
      subscriptionBooking()
      data.value.event.cancellationDeadlineHours = 100000
      wrapper = await render()
      expect(wrapper.text()).not.toContain('Занятие вернётся на абонемент')
    })

    it('is not shown for cash bookings or for a waitlisted subscription booking', async () => {
      subscriptionBooking({ method: 'cash', paymentId: 9 })
      wrapper = await render()
      expect(wrapper.text()).not.toContain('Занятие вернётся на абонемент')
      wrapper.unmount()
      subscriptionBooking({ status: 'waitlisted' })
      wrapper = await render()
      expect(wrapper.text()).not.toContain('Занятие вернётся на абонемент')
    })
  })

  it('removes part of the seats with PATCH, warns about paid seats and keeps the rest', async () => {
    data.value.event.cancellationAllowed = true
    data.value.event.cancellationDeadlineHours = null
    data.value.event.myBooking = {
      id: 5,
      status: 'confirmed',
      method: 'cash',
      paymentId: 9,
      seats: 3,
      waitlistSeats: 0,
      seatPayments: { paidSeats: 3, pendingSeats: 0, releasedPaidSeats: 0 },
    } as unknown as typeof data.value.event.myBooking
    wrapper = await render()
    await button('Снять 1 место').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Останется 2 места'))
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('Оплаченные места освободятся без возврата денег'),
    )
    expect(post).toHaveBeenCalledExactlyOnceWith('/api/organizations/30/bookings/5', {
      method: 'PATCH',
      body: { seats: 2 },
    })
    expect(haptic).toHaveBeenCalledWith('success')
    expect(
      wrapper
        .findAll('p[role="status"]')
        .some((p) => p.text().includes('Оплаченные места освободятся без возврата денег')),
    ).toBe(true)
  })
})

describe('«без возврата» only for really paid seats (21.1.8, D-14)', () => {
  const book = (seatPayments: Record<string, number>) => {
    data.value.event.cancellationAllowed = true
    data.value.event.cancellationDeadlineHours = null
    data.value.event.myBooking = {
      id: 5,
      status: 'confirmed',
      method: 'cash',
      paymentId: 9,
      seats: 2,
      waitlistSeats: 0,
      seatPayments,
    } as unknown as typeof data.value.event.myBooking
  }

  it('does not warn when a cash booking has no paid seat yet (full and partial cancel)', async () => {
    book({ paidSeats: 0, pendingSeats: 2, releasedPaidSeats: 0 })
    wrapper = await render()
    await button('Снять 1 место').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Останется 1 место'))
    expect(confirm).not.toHaveBeenCalledWith(expect.stringContaining('без возврата'))
    await button('Отменить запись').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(confirm).not.toHaveBeenCalledWith(expect.stringContaining('без возврата'))
    expect(wrapper.findAll('p[role="status"]').some((p) => p.text().includes('без возврата'))).toBe(
      false,
    )
  })

  it('warns on full cancel when a seat is paid', async () => {
    book({ paidSeats: 1, pendingSeats: 1, releasedPaidSeats: 0 })
    wrapper = await render()
    await button('Отменить запись').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('без возврата денег'))
  })

  it('does not warn on partial cancel when only the unpaid seat is dropped', async () => {
    book({ paidSeats: 1, pendingSeats: 1, releasedPaidSeats: 0 })
    wrapper = await render()
    await button('Снять 1 место').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Останется 1 место'))
    expect(confirm).not.toHaveBeenCalledWith(expect.stringContaining('без возврата'))
  })
})

describe('roster player level chip (20.4.10)', () => {
  const rosterRow = (id: number, name: string, level: string | null) => ({
    user: { id, name, telegramUsername: null, image: null },
    paid: false,
    level,
  })
  const rosterSection = () =>
    wrapper!.find('#event-roster-title').element.closest('section')!.textContent ?? ''

  it('shows the scale title next to a roster player who has a level', async () => {
    data.value.roster = [rosterRow(1, 'Синтетический Игрок', 'v2')]
    wrapper = await render()
    expect(rosterSection()).toContain('Синтетический Игрок')
    expect(rosterSection()).toContain('В2')
  })

  it('shows no chip for a roster player without a level and no A/B/C', async () => {
    data.value.roster = [rosterRow(2, 'Синтетический Без Уровня', null)]
    wrapper = await render()
    expect(rosterSection()).toContain('Синтетический Без Уровня')
    expect(rosterSection()).not.toMatch(/\b[ABC]\b/)
    expect(rosterSection()).not.toContain('В')
  })
})
