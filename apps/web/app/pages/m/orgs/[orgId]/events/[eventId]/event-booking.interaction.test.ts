// @vitest-environment happy-dom
import { BookInput } from '@volley-time/core'
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
import WaitlistOfferCard from '~/components/WaitlistOfferCard.vue'
import MyChip from '~/components/vt/MyChip.vue'
import SeatsMini from '~/components/vt/SeatsMini.vue'
import StateChip from '~/components/vt/StateChip.vue'
import Toggle from '~/components/vt/Toggle.vue'
import { apiErrorCode, apiErrorMessage, apiErrorStatus } from '~/utils/api-error'

/**
 * Task 20.4.5 (M-06): запись на несколько мест, согласие на частичную очередь, предложение места
 * из очереди и «+N» в составе. API замокан; тела запросов разбираются схемой BookInput.
 */
const NOW = new Date('2027-10-03T10:00:00Z')
const route = reactive({ params: { orgId: '30', eventId: '71' }, fullPath: '/m/orgs/30/events/71' })
const fixedPricing = (): EventPricingView => ({
  mode: 'fixed',
  targetAmount: null,
  settledAt: null,
  participantCount: 0,
  minAmount: 1500,
  maxAmount: 1500,
  basis: 'fixed',
  myAllocatedAmount: null,
  myPaymentStatus: null,
})
type MyBooking = null | {
  id: number
  status: string
  method: string
  paymentId: number | null
  seats?: number
  waitlistSeats?: number
  offer?: { id: number; seats: number; expiresAt: string } | null
}
const fixture = () => ({
  id: 71,
  organizationId: 30,
  title: 'Открытая игра',
  status: 'published',
  startsAt: '2027-10-04T16:00:00Z',
  endsAt: '2027-10-04T18:00:00Z',
  capacity: 14,
  taken: 9,
  players: 9,
  freeSeats: 5,
  waitlist: 0,
  price: 1500,
  currency: 'BYN',
  description: null,
  cancellationDeadlineHours: null as number | null,
  bookingOpensAt: null as string | null,
  venue: null,
  locationText: null,
  pricing: fixedPricing(),
  myBooking: null as MyBooking,
})
const orgFixture = (
  multiSeat: boolean,
  opts: { maxSeatsPerBooking?: number; subs?: boolean; scheduler?: boolean } = {},
) => ({
  organization: {
    id: 30,
    subscriptionsEnabled: opts.subs ?? false,
    maxSeatsPerBooking: opts.maxSeatsPerBooking ?? 3,
  },
  myMember: { organizationId: 30, role: 'player', status: 'active' },
  capabilities: { eventMultiSeat: multiSeat, eventScheduler: opts.scheduler ?? false },
})
const subscription = {
  id: 3,
  organizationId: 30,
  status: 'active',
  usedSessions: 2,
  totalSessions: 8,
  expiresAt: null,
}
type PageData = { event: ReturnType<typeof fixture>; roster: unknown[]; serverNow?: string }
let data = ref<PageData>({ event: fixture(), roster: [] as unknown[] })
let org = ref(orgFixture(true))
const refresh = vi.fn(async () => undefined)
const post = vi.fn(
  async (
    url: string,
    _opts?: { method?: string; body?: unknown; query?: unknown },
  ): Promise<unknown> => {
    if (url.endsWith('/price')) return { price: { total: { min: 4321 }, currency: 'BYN' } }
    if (url.endsWith('/subscriptions/my')) return { subscriptions: [subscription] }
    return {}
  },
)
let inTelegram = false
const mainButtonUpdate = vi.fn()
let mainButtonClick: (() => void) | undefined
let wrapper: Awaited<ReturnType<typeof render>> | undefined

async function render() {
  const mounted = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Page) }) }),
    {
      attachTo: document.body,
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: true,
          VtChip: { template: '<span><slot /></span>' },
          VtMyChip: MyChip,
          VtStateChip: StateChip,
          VtSeatsMini: SeatsMini,
          VtIcon: true,
          VtMeter: true,
          VtAvatar: true,
          VtToggle: Toggle,
          SkeletonList: true,
          PlayerBookingForm,
          WaitlistOfferCard,
          BookingSeatsStepper,
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
const sheet = () => wrapper!.get('[role="dialog"]')
const pageButton = (label: string) =>
  wrapper!.findAll('button').find((b) => b.text().startsWith(label))
const sheetButton = (label: string) =>
  sheet()
    .findAll('button')
    .find((b) => b.text().startsWith(label))
const bookingCalls = () => post.mock.calls.filter(([url]) => url.endsWith('/bookings'))
const lastBookingBody = () => bookingCalls().at(-1)?.[1]?.body
const open = async () => {
  await pageButton('Записаться')!.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    now: NOW,
  })
  data = ref<PageData>({ event: fixture(), roster: [] as unknown[] })
  org = ref(orgFixture(true))
  route.params = { orgId: '30', eventId: '71' }
  route.fullPath = '/m/orgs/30/events/71'
  refresh.mockReset().mockResolvedValue(undefined)
  post.mockClear()
  inTelegram = false
  mainButtonUpdate.mockClear()
  mainButtonClick = undefined
  Object.entries({
    computed,
    ref,
    watch,
    watchEffect,
    onMounted,
    onUnmounted,
    createMainButton: (_tg: unknown, onClick: () => void) => {
      mainButtonClick = onClick
      return { update: mainButtonUpdate, destroy: vi.fn() }
    },
    definePageMeta: () => undefined,
    useRoute: () => route,
    useOrgTimezone: () => ({ tz: 'Europe/Minsk' }),
    useTelegram: () => ({
      confirm: vi.fn(async () => true),
      haptic: vi.fn(),
      isTelegram: ref(inTelegram),
      webApp: undefined,
    }),
    $fetch: post,
    refreshNuxtData: vi.fn(async () => undefined),
    apiErrorCode,
    apiErrorMessage,
    apiErrorStatus,
    useFetch: (url: string | (() => string)) => {
      const path = typeof url === 'function' ? url() : url
      if (path === '/api/levels')
        return { data: ref({ levels: [] }), error: ref(null), pending: ref(false) }
      return {
        data: path.endsWith('/30') ? org : data,
        error: ref(null),
        pending: ref(false),
        refresh,
      }
    },
  }).forEach(([name, value]) => vi.stubGlobal(name, value))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('seat stepper (M-06)', () => {
  it('flag off: single-seat UI, request body without seats', async () => {
    org.value = orgFixture(false)
    wrapper = await render()
    await open()
    expect(sheet().find('[aria-label="Больше мест"]').exists()).toBe(false)
    expect(sheet().text()).not.toContain('Сколько мест')
    await sheetButton('Записаться')!.trigger('click')
    await flushPromises()
    expect(lastBookingBody()).toEqual({ method: 'cash' })
    BookInput.parse(lastBookingBody())
  })

  it('flag on: the stepper stops at the group max and sends seats', async () => {
    wrapper = await render()
    await open()
    const plus = () => sheet().get('[aria-label="Больше мест"]')
    await plus().trigger('click')
    await plus().trigger('click')
    expect(sheet().text()).toContain('Я и ещё 2')
    expect(plus().attributes('disabled')).toBeDefined()
    expect(sheet().text()).toMatch(/Можно занять до 3 мест(?!а)/)
    await sheetButton('Записаться · 3 места')!.trigger('click')
    await flushPromises()
    expect(lastBookingBody()).toEqual({ method: 'cash', seats: 3 })
    expect(BookInput.parse(lastBookingBody())).toMatchObject({ seats: 3, allowWaitlist: false })
  })

  it('is limited by the event capacity', async () => {
    data.value.event.capacity = 2
    data.value.event.taken = 0
    data.value.event.freeSeats = 2
    wrapper = await render()
    await open()
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    expect(sheet().get('[aria-label="Больше мест"]').attributes('disabled')).toBeDefined()
    expect(sheet().text()).toMatch(/Можно занять до 2 мест(?!а)/)
  })

  it('takes the total for several seats from GET …/price, not from a client multiplication', async () => {
    wrapper = await render()
    await open()
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    await flushPromises()
    const priceCall = post.mock.calls.find(([url]) => url.endsWith('/events/71/price'))
    expect(priceCall?.[1]).toMatchObject({ query: { seats: 2 } })
    expect(sheet().text()).toContain('За все места')
    expect(sheet().text()).toContain('43,21')
    expect(sheet().text()).not.toContain('30,00')
  })
})

describe('partial queue needs explicit consent (M-06)', () => {
  beforeEach(() => {
    data.value.event.freeSeats = 1
    data.value.event.taken = 13
  })

  it('blocks the request until the player agrees, then sends allowWaitlist', async () => {
    wrapper = await render()
    await open()
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    expect(sheet().text()).toContain('Свободно 1 место из 3')
    expect(sheet().text()).toContain('ещё 2 места встанут в лист ожидания')
    const submit = () => sheetButton('Записаться · 3 места')!
    expect(submit().attributes('disabled')).toBeDefined()
    await submit().trigger('click')
    expect(bookingCalls()).toHaveLength(0)

    await sheet().get('[role="switch"]').trigger('click')
    expect(submit().attributes('disabled')).toBeUndefined()
    await submit().trigger('click')
    await flushPromises()
    expect(lastBookingBody()).toEqual({ method: 'cash', seats: 3, allowWaitlist: true })
    expect(BookInput.parse(lastBookingBody())).toMatchObject({ seats: 3, allowWaitlist: true })
  })

  it('asks again after the number of seats changes', async () => {
    wrapper = await render()
    await open()
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    await sheet().get('[role="switch"]').trigger('click')
    expect(sheetButton('Записаться · 2 места')!.attributes('disabled')).toBeUndefined()
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    expect(sheetButton('Записаться · 3 места')!.attributes('disabled')).toBeDefined()
    expect(sheet().get('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('a stale refusal 409 booking.not_enough_seats refreshes the free seats', async () => {
    wrapper = await render()
    data.value.event.freeSeats = 5
    await open()
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    post.mockRejectedValueOnce({
      statusCode: 409,
      data: { data: { code: 'booking.not_enough_seats' } },
    })
    await sheetButton('Записаться · 2 места')!.trigger('click')
    await flushPromises()
    expect(refresh).toHaveBeenCalled()
    expect(sheet().text()).toContain('Свободных мест меньше, чем вы выбрали')
  })
})

describe('no free seats: queue branch keeps the payment choice (M-06, D-03 C)', () => {
  beforeEach(() => {
    data.value.event.freeSeats = 0
    data.value.event.taken = 14
    data.value.event.waitlist = 2
  })

  it('shows how the queue works; cash and transfer are selectable; nothing is charged now', async () => {
    wrapper = await render()
    await pageButton('Встать в лист ожидания')!.trigger('click')
    await flushPromises()
    expect(sheet().text()).toContain('Как это работает')
    expect(sheet().text()).toContain('Подтвердить за 30 минут')
    expect(sheet().text()).toContain('покинете очередь')
    expect(sheet().text()).not.toContain('в конец')
    expect(sheet().text()).toContain('Сейчас в очереди 2 места')
    expect(sheet().text()).toContain('Сейчас ничего не списываем')
    expect(sheet().findAll('input[type="radio"]')).toHaveLength(2)
    expect(sheet().find('[role="switch"]').exists()).toBe(false)

    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    await sheetButton('В лист ожидания · 2 места')!.trigger('click')
    await flushPromises()
    // очередь целиком: согласие не нужно и не отправляется
    expect(lastBookingBody()).toEqual({ method: 'cash', seats: 2 })
    BookInput.parse(lastBookingBody())
  })

  it('a queue booking with a subscription sends subscription and its id (activity restored)', async () => {
    org.value = orgFixture(true, { subs: true })
    wrapper = await render()
    await pageButton('Встать в лист ожидания')!.trigger('click')
    await flushPromises()
    expect(post.mock.calls.some(([url]) => url.endsWith('/subscriptions/my'))).toBe(true)
    expect(sheet().text()).toContain(
      'спишется при переходе в состав, не хватит занятий — наличными',
    )
    await sheetButton('Встать в лист ожидания')!.trigger('click')
    await flushPromises()
    expect(lastBookingBody()).toEqual({ method: 'subscription', subscriptionId: 3 })
    expect(BookInput.parse(lastBookingBody())).toMatchObject({ subscriptionId: 3 })
  })

  it('flag off: the queue body is the same as before 20.4.5', async () => {
    org.value = orgFixture(false, { subs: true })
    wrapper = await render()
    await pageButton('Встать в лист ожидания')!.trigger('click')
    await flushPromises()
    await sheet().findAll('input[type="radio"]')[1]!.setValue()
    await sheetButton('Встать в лист ожидания')!.trigger('click')
    await flushPromises()
    expect(lastBookingBody()).toEqual({ method: 'cash' })
  })

  it('a free event in the queue shows no payment choice and says so', async () => {
    data.value.event.price = 0
    data.value.event.pricing = { ...fixedPricing(), minAmount: 0, maxAmount: 0 }
    wrapper = await render()
    await pageButton('Встать в лист ожидания')!.trigger('click')
    await flushPromises()
    expect(sheet().find('input[type="radio"]').exists()).toBe(false)
    expect(sheet().text()).toContain('платить не придётся')
    await sheetButton('Встать в лист ожидания')!.trigger('click')
    await flushPromises()
    expect(lastBookingBody()).toEqual({ method: 'free' })
  })
})

describe('free event with several seats (M-06)', () => {
  it('opens the stepper instead of posting at once and sends method free', async () => {
    data.value.event.price = 0
    data.value.event.pricing = { ...fixedPricing(), minAmount: 0, maxAmount: 0 }
    wrapper = await render()
    await pageButton('Записаться')!.trigger('click')
    await flushPromises()
    expect(bookingCalls()).toHaveLength(0)
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    await sheetButton('Записаться · 2 места')!.trigger('click')
    await flushPromises()
    expect(lastBookingBody()).toEqual({ method: 'free', seats: 2 })
  })
})

describe('my booking and roster (M-06)', () => {
  it('«Я записан на N мест» and the queue part', async () => {
    data.value.event.myBooking = {
      id: 5,
      status: 'confirmed',
      method: 'cash',
      paymentId: null,
      seats: 2,
      waitlistSeats: 1,
    }
    wrapper = await render()
    const card = wrapper.get('[aria-label="Ваша запись"]').text()
    expect(card).toContain('Вы записаны на 2 места')
    expect(card).toContain('2 места за вами, ещё 1 место в очереди')
  })

  it('«+N» for a multi-seat player and the guests hint', async () => {
    data.value.event.players = 7
    data.value.roster = [
      { user: { id: 1, name: 'Маша', telegramUsername: null, image: null }, paid: true, seats: 3 },
      { user: { id: 2, name: 'Игорь', telegramUsername: null, image: null }, paid: true, seats: 1 },
    ]
    wrapper = await render()
    const roster = wrapper.get('#event-roster-title').element.closest('section')!
    expect(roster.textContent).toContain('+2')
    expect(roster.textContent).toContain('7 игроков заняли 9 мест')
    expect(roster.textContent).not.toContain('+0')
  })

  it('does not show the guests hint when every player holds one seat', async () => {
    data.value.event.players = 9
    wrapper = await render()
    expect(wrapper.text()).not.toContain('приводит гостей')
  })

  it('closed booking: no booking action and an honest explanation', async () => {
    data.value.event.status = 'closed'
    wrapper = await render()
    expect(pageButton('Записаться')).toBeUndefined()
    expect(wrapper.text()).toContain('Запись закрыта')
  })

  it('booking opens later: no action, the opening time is shown', async () => {
    data.value.event.bookingOpensAt = '2027-10-03T12:00:00Z'
    wrapper = await render()
    expect(pageButton('Записаться')).toBeUndefined()
    expect(wrapper.text()).toContain('Запись откроется')
  })
})

describe('waitlist offer (D-03, 20.3.1)', () => {
  const offerBooking = (expiresAt: string): MyBooking => ({
    id: 5,
    status: 'waitlisted',
    method: 'cash',
    paymentId: null,
    seats: 2,
    waitlistSeats: 0,
    offer: { id: 7, seats: 2, expiresAt },
  })

  it('shows the countdown and accepts within the TTL', async () => {
    data.value.event.myBooking = offerBooking('2027-10-03T10:29:41Z')
    wrapper = await render()
    expect(wrapper.text()).toContain('Освободилось 2 места')
    expect(wrapper.get('[role="timer"]').text()).toBe('29:41')
    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.get('[role="timer"]').text()).toBe('29:36')

    await pageButton('Принять место')!.trigger('click')
    await flushPromises()
    expect(post).toHaveBeenCalledWith('/api/organizations/30/waitlist-offers/7/accept', {
      method: 'POST',
    })
    expect(refresh).toHaveBeenCalled()
  })

  it('after the TTL the player has left the queue: no accept, the outcome is explained', async () => {
    data.value.event.myBooking = offerBooking('2027-10-03T10:00:03Z')
    wrapper = await render()
    expect(pageButton('Принять место')).toBeDefined()
    await vi.advanceTimersByTimeAsync(4000)
    expect(pageButton('Принять место')).toBeUndefined()
    expect(wrapper.text()).toContain('вы покинули очередь')
    // экран перечитывает событие: сервер уже снял игрока с очереди
    expect(refresh).toHaveBeenCalled()
  })

  it('an offer already expired on the server (410) shows the outcome and refreshes', async () => {
    data.value.event.myBooking = offerBooking('2027-10-03T10:10:00Z')
    wrapper = await render()
    post.mockRejectedValueOnce({
      statusCode: 410,
      data: { data: { code: 'waitlist_offer.expired' } },
    })
    await pageButton('Принять место')!.trigger('click')
    await flushPromises()
    expect(refresh).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Предложение места больше не действует')
  })
})

describe('Telegram MainButton drives the booking sheet (20.4.1, 20.4.5)', () => {
  const lastState = () => mainButtonUpdate.mock.calls.at(-1)?.[0]
  beforeEach(() => {
    inTelegram = true
  })

  it('opens the sheet, then submits it; the in-sheet button is not rendered', async () => {
    wrapper = await render()
    expect(lastState()).toMatchObject({ text: 'Записаться' })
    mainButtonClick!()
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(sheetButton('Записаться')).toBeUndefined()
    expect(lastState()).toMatchObject({ text: 'Записаться', disabled: false })
    mainButtonClick!()
    await flushPromises()
    expect(lastBookingBody()).toEqual({ method: 'cash' })
  })

  it('stays disabled while the partial queue is not agreed', async () => {
    data.value.event.freeSeats = 1
    data.value.event.taken = 13
    wrapper = await render()
    mainButtonClick!()
    await flushPromises()
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    expect(lastState()).toMatchObject({ text: 'Записаться · 2 места', disabled: true })
    mainButtonClick!()
    await flushPromises()
    expect(bookingCalls()).toHaveLength(0)
    await sheet().get('[role="switch"]').trigger('click')
    expect(lastState()).toMatchObject({ disabled: false })
  })

  it('accepts a waitlist offer from the MainButton', async () => {
    data.value.event.myBooking = {
      id: 5,
      status: 'waitlisted',
      method: 'cash',
      paymentId: null,
      seats: 1,
      waitlistSeats: 0,
      offer: { id: 7, seats: 1, expiresAt: '2027-10-03T10:20:00Z' },
    }
    wrapper = await render()
    expect(lastState()).toMatchObject({ text: 'Принять место' })
    expect(wrapper.text()).not.toContain('Принять место')
    mainButtonClick!()
    await flushPromises()
    expect(post).toHaveBeenCalledWith('/api/organizations/30/waitlist-offers/7/accept', {
      method: 'POST',
    })
  })
})

describe('review #156 follow-ups', () => {
  it('M2: the countdown follows server time, not the phone clock', async () => {
    // телефон «отстаёт» на 10 минут: сервер уже 10:10, срок предложения — 10:10:30
    data.value.serverNow = '2027-10-03T10:10:00Z'
    data.value.event.myBooking = {
      id: 5,
      status: 'waitlisted',
      method: 'cash',
      paymentId: null,
      seats: 1,
      waitlistSeats: 0,
      offer: { id: 7, seats: 1, expiresAt: '2027-10-03T10:10:30Z' },
    }
    wrapper = await render()
    expect(wrapper.get('[role="timer"]').text()).toBe('0:30')
  })

  it('M3: opening time passes → the booking action appears and the event is re-read', async () => {
    data.value.event.bookingOpensAt = '2027-10-03T10:01:00Z'
    wrapper = await render()
    expect(pageButton('Записаться')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(61_000)
    expect(refresh).toHaveBeenCalled()
    expect(pageButton('Записаться')).toBeDefined()
  })

  it('M3: the close moment passes → «Запись закрыта», no action (scheduler on)', async () => {
    org.value = orgFixture(true, { scheduler: true })
    data.value.event.startsAt = '2027-10-03T12:01:00Z' // закрытие за 2 ч = 10:01
    Object.assign(data.value.event, { closeBeforeMinutes: 120, bookingClosed: false })
    // на границе экран перечитывает событие; сервер отвечает: запись закрыта
    refresh.mockImplementation(async () => {
      data.value.event = { ...data.value.event, bookingClosed: true } as typeof data.value.event
    })
    wrapper = await render()
    expect(pageButton('Записаться')).toBeDefined()
    await vi.advanceTimersByTimeAsync(61_000)
    expect(pageButton('Записаться')).toBeUndefined()
    expect(wrapper.text()).toContain('Запись закрыта')
  })

  it('M4: the seat bar counts seats held by offers like the action does', async () => {
    data.value.event.freeSeats = 0
    wrapper = await render()
    expect(wrapper.get('.vt-seats-mini').text()).toContain('мест нет')
  })

  it('M5: consent survives a refresh that leaves the split unchanged', async () => {
    data.value.event.freeSeats = 1
    wrapper = await render()
    await open()
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    await sheet().get('[role="switch"]').trigger('click')
    data.value = { ...data.value, event: { ...data.value.event } }
    await flushPromises()
    expect(sheet().get('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('M6: partial queue charges only the main seats; the subscription hint names the cash fallback', async () => {
    org.value = orgFixture(true, { subs: true })
    data.value.event.freeSeats = 2
    wrapper = await render()
    await open()
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    await flushPromises()
    const priceCall = post.mock.calls.filter(([url]) => url.endsWith('/events/71/price')).at(-1)
    expect(priceCall?.[1]).toMatchObject({ query: { seats: 2 } })
    expect(sheet().text()).toContain('К оплате за 2 места')
    expect(sheet().text()).toContain('места из очереди — по занятиям, не хватит — наличными')
  })

  it('M7: the seat count is announced through visually hidden live text', async () => {
    wrapper = await render()
    await open()
    await sheet().get('[aria-label="Больше мест"]').trigger('click')
    expect(sheet().get('.sr-only[aria-live="polite"]').text()).toBe('2 места')
  })
})
