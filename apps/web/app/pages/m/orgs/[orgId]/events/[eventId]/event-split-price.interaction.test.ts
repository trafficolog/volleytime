// @vitest-environment happy-dom
import type { EventPricingView } from '@volley-time/shared'
import { quoteEventPrice } from '@volley-time/shared'
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
import PlayerSplitPriceCard from '~/components/PlayerSplitPriceCard.vue'
import WaitlistOfferCard from '~/components/WaitlistOfferCard.vue'
import MyChip from '~/components/vt/MyChip.vue'
import SeatsMini from '~/components/vt/SeatsMini.vue'
import StateChip from '~/components/vt/StateChip.vue'
import Toggle from '~/components/vt/Toggle.vue'
import { formatMoneyRu } from '~/utils/labels'

/**
 * Task 20.4.6 (M-07): событие со сбором суммой. Цена и прогноз берутся из ответа
 * `GET …/events/{id}/price` (`quoteEventPrice`), а не из `pricing` самого события
 * (`readEventPricing`): в фикстуре `pricing` намеренно расходится с ответом цены.
 */
const route = reactive({ params: { orgId: '30', eventId: '71' }, fullPath: '/m/orgs/30/events/71' })
const money = (minor: number) => formatMoneyRu(minor, 'BYN')
// «чужая» проекция: если экран возьмёт цену отсюда, тесты увидят 11,11
const legacyPricing = (): EventPricingView => ({
  mode: 'split',
  targetAmount: 10000,
  settledAt: null,
  participantCount: 8,
  minAmount: 1111,
  maxAmount: 1111,
  basis: 'current',
  myAllocatedAmount: null,
  myPaymentStatus: null,
})
type MyBooking = null | {
  id: number
  status: string
  method: string
  paymentId: number | null
  seats?: number
}
const fixture = () => ({
  id: 71,
  organizationId: 30,
  title: 'Сбор суммой',
  status: 'published',
  startsAt: '2027-10-04T16:00:00Z',
  endsAt: '2027-10-04T18:00:00Z',
  capacity: 14,
  taken: 8,
  players: 8,
  freeSeats: 6,
  waitlist: 0,
  price: 0,
  currency: 'BYN',
  description: null,
  cancellationDeadlineHours: null as number | null,
  bookingOpensAt: null as string | null,
  venue: null,
  locationText: null,
  pricing: legacyPricing(),
  myBooking: null as MyBooking,
})
const forecastQuote = (taken: number, mySeats = 0, seats = 1) => ({
  ...quoteEventPrice({
    mode: 'split',
    targetAmount: 10000,
    capacity: 14,
    takenSeats: taken,
    mySeats,
    seats,
    settled: null,
  }),
  currency: 'BYN',
})
const settledQuote = (participants: number, allocated: number | null, mySeats = 1) => ({
  ...quoteEventPrice({
    mode: 'split',
    targetAmount: 10000,
    capacity: 14,
    takenSeats: participants,
    mySeats,
    seats: mySeats || 1,
    settled: { participantCount: participants, myAllocatedAmount: allocated },
  }),
  currency: 'BYN',
})

let data = ref({ event: fixture(), roster: [] as unknown[] })
const org = ref({
  organization: { id: 30, subscriptionsEnabled: true, maxSeatsPerBooking: 3 },
  myMember: { organizationId: 30, role: 'player', status: 'active' },
  capabilities: { eventMultiSeat: true, eventScheduler: false },
})
const refresh = vi.fn(async () => undefined)
let priceResponse: () => unknown = () => ({ price: forecastQuote(8) })
const apiFetch = vi.fn(async (url: string, options?: { method?: string; query?: unknown }) => {
  if (url.endsWith('/price')) {
    const seats = (options?.query as { seats?: number } | undefined)?.seats
    return seats ? { price: forecastQuote(8, 0, seats) } : priceResponse()
  }
  if (url.endsWith('/subscriptions/my')) return { subscriptions: [] }
  return {}
})
for (const [name, value] of Object.entries({
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
  useTelegram: () => ({
    confirm: vi.fn(async () => true),
    haptic: vi.fn(),
    isTelegram: ref(false),
    webApp: undefined,
  }),
  $fetch: apiFetch,
  refreshNuxtData: vi.fn(),
  apiErrorCode: () => undefined,
  apiErrorStatus: () => 500,
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}))
  vi.stubGlobal(name, value)
vi.stubGlobal('useFetch', (url: string | (() => string)) => {
  const path = typeof url === 'function' ? url() : url
  if (path === '/api/levels')
    return { data: ref({ levels: [] }), error: ref(null), pending: ref(false) }
  return {
    data: path.endsWith('/30') ? org : data,
    error: ref(null),
    pending: ref(false),
    refresh,
  }
})

async function renderPage() {
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Page) }) }),
    {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: true,
          VtChip: { template: '<span><slot /></span>' },
          PlayerBookingForm,
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
          ErrorState: true,
          VtSheet: {
            props: ['modelValue'],
            template: '<div v-if="modelValue" role="dialog"><slot /></div>',
          },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}
const priceCalls = () => apiFetch.mock.calls.filter(([url]) => url.endsWith('/events/71/price'))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2027-10-03T10:00:00Z'))
  data = ref({ event: fixture(), roster: [] })
  priceResponse = () => ({ price: forecastQuote(8) })
  route.params.orgId = '30'
  route.params.eventId = '71'
  route.fullPath = '/m/orgs/30/events/71'
  apiFetch.mockClear()
  refresh.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('M-07 · событие со сбором суммой: цена из GET …/price', () => {
  it('до закрытия: цель сбора, прогноз «≈ … за место», диапазон и пометка про абонемент', async () => {
    const quote = forecastQuote(8)
    const wrapper = await renderPage()
    expect(priceCalls().length).toBeGreaterThanOrEqual(1)
    const block = wrapper.get('[data-player-split]')
    expect(block.attributes('data-stage')).toBe('open')
    expect(block.text()).toContain('Делим общую сумму')
    expect(block.text()).toContain('предварительно')
    expect(block.get('[data-price-headline]').text()).toBe(`≈ ${money(quote.perSeat.max)}`)
    expect(block.get('[data-price-range]').text()).toBe(
      `от ${money(quote.perSeat.min)} до ${money(quote.perSeat.max)}`,
    )
    expect(block.get('[data-price-divider]').text()).toBe(
      `${money(10000)} ÷ ${quote.seatCount!.current} мест с вами`,
    )
    expect(block.get('[data-price-note]').text()).toBe('если запишетесь')
    expect(block.text()).toContain('Абонемент к событию со сбором суммой не применяется')
    expect(block.findAll('[data-price-scenario]').length).toBeGreaterThanOrEqual(2)
    wrapper.unmount()
  })

  it('показанная цена совпадает с ответом эндпоинта и не берётся из pricing события', async () => {
    const quote = forecastQuote(8)
    const wrapper = await renderPage()
    const text = wrapper.text()
    expect(text).toContain(money(quote.perSeat.max))
    expect(text).toContain(money(quote.perSeat.min))
    // readEventPricing в фикстуре говорит 11,11 — на экране этой цифры быть не должно
    expect(text).not.toContain(money(1111))
    // сводная ячейка «Цена» шапки показывает ту же цифру
    expect(wrapper.get('[data-summary-price]').text()).toBe(`≈ ${money(quote.perSeat.max)}`)
    wrapper.unmount()
  })

  it('после новой записи прогноз перечитывается и обновляется', async () => {
    const wrapper = await renderPage()
    const before = wrapper.get('[data-price-divider]').text()
    const callsBefore = priceCalls().length
    const headlineBefore = wrapper.get('[data-price-headline]').text()
    // записался ещё один игрок: в составе 9 мест, я пока не записан
    priceResponse = () => ({ price: forecastQuote(9) })
    data.value = { ...data.value, event: { ...data.value.event, taken: 9 } }
    await flushPromises()
    expect(priceCalls().length).toBeGreaterThan(callsBefore)
    const after = wrapper.get('[data-price-divider]').text()
    expect(after).not.toBe(before)
    expect(after).toBe(`${money(10000)} ÷ ${forecastQuote(9).seatCount!.current} мест с вами`)
    expect(wrapper.get('[data-price-headline]').text()).not.toBe(headlineBefore)
    expect(wrapper.get('[data-summary-price]').text()).toBe(
      wrapper.get('[data-price-headline]').text(),
    )
    wrapper.unmount()
  })

  it('запись закрыта, доля рассчитана: итоговая доля и «с вас» за все места', async () => {
    const quote = settledQuote(3, 6667, 2)
    priceResponse = () => ({ price: quote })
    data.value = {
      ...data.value,
      event: {
        ...fixture(),
        status: 'closed',
        taken: 3,
        myBooking: { id: 5, status: 'pending_payment', method: 'cash', paymentId: 9, seats: 2 },
        pricing: {
          ...legacyPricing(),
          basis: 'settled',
          settledAt: '2027-10-03T09:00:00Z',
          myAllocatedAmount: 6667,
          myPaymentStatus: 'pending',
        },
      },
    }
    const wrapper = await renderPage()
    const block = wrapper.get('[data-player-split]')
    expect(block.attributes('data-stage')).toBe('settled')
    expect(block.text()).toContain('Итоговый расчёт')
    expect(block.text()).toContain('зафиксировано')
    expect(block.get('[data-price-headline]').text()).toBe(money(quote.perSeat.max))
    expect(block.get('[data-price-headline]').text().startsWith('≈')).toBe(false)
    expect(block.get('[data-price-due]').text()).toBe(money(quote.total.max))
    expect(block.text()).toContain('за 2 места')
    expect(block.findAll('[data-price-scenario]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('оплачено: состояние «Оплачено», «с вас» нет', async () => {
    priceResponse = () => ({ price: settledQuote(3, 3334) })
    data.value = {
      ...data.value,
      event: {
        ...fixture(),
        status: 'closed',
        taken: 3,
        myBooking: { id: 5, status: 'confirmed', method: 'cash', paymentId: 9, seats: 1 },
        pricing: {
          ...legacyPricing(),
          basis: 'settled',
          settledAt: '2027-10-03T09:00:00Z',
          myAllocatedAmount: 3334,
          myPaymentStatus: 'succeeded',
        },
      },
    }
    const wrapper = await renderPage()
    const block = wrapper.get('[data-player-split]')
    expect(block.attributes('data-stage')).toBe('paid')
    expect(block.text()).toContain('оплачено')
    expect(block.find('[data-price-due]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('«мест нет» — по занятости события, а не по цене', async () => {
    priceResponse = () => ({ price: forecastQuote(14) })
    data.value = {
      ...data.value,
      event: { ...fixture(), taken: 14, freeSeats: 0, pricing: legacyPricing() },
    }
    const wrapper = await renderPage()
    expect(wrapper.get('[data-player-split]').text()).toContain('мест нет')
    wrapper.unmount()
    data.value = { ...data.value, event: { ...fixture(), taken: 13, freeSeats: 1 } }
    priceResponse = () => ({ price: forecastQuote(13) })
    const open = await renderPage()
    expect(open.get('[data-player-split]').text()).not.toContain('мест нет')
    open.unmount()
  })

  it('отменённое событие: цену не показываем и не запрашиваем', async () => {
    data.value = { ...data.value, event: { ...fixture(), status: 'cancelled' } }
    const wrapper = await renderPage()
    expect(wrapper.find('[data-player-split]').exists()).toBe(false)
    expect(wrapper.find('[data-summary-price]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(money(1111))
    expect(wrapper.text()).not.toContain('≈')
    expect(priceCalls()).toHaveLength(0)
    wrapper.unmount()
  })

  it('ответ цены недоступен: чисел из readEventPricing нет, экран честно говорит об этом', async () => {
    priceResponse = () => {
      throw new Error('network')
    }
    const wrapper = await renderPage()
    expect(wrapper.find('[data-player-split]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(money(1111))
    expect(wrapper.text()).toContain('Прогноз цены сейчас недоступен')
    wrapper.unmount()
  })

  it('игрок в листе ожидания: «если получите место», доли не начислено', async () => {
    priceResponse = () => ({ price: forecastQuote(14) })
    data.value = {
      ...data.value,
      event: {
        ...fixture(),
        taken: 14,
        freeSeats: 0,
        myBooking: { id: 5, status: 'waitlisted', method: 'cash', paymentId: null },
      },
    }
    const wrapper = await renderPage()
    const block = wrapper.get('[data-player-split]')
    expect(block.get('[data-price-note]').text()).toBe('если получите место')
    expect(block.get('[data-price-headline]').text()).toBe(
      `≈ ${money(forecastQuote(14).perSeat.max)}`,
    )
    expect(block.find('[data-price-due]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('смена события сбрасывает цену прежнего, пока грузится новая', async () => {
    const wrapper = await renderPage()
    expect(wrapper.find('[data-player-split]').exists()).toBe(true)
    let release!: (value: unknown) => void
    apiFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    data.value = { ...data.value, event: { ...fixture(), id: 72 } }
    route.params.eventId = '72'
    await flushPromises()
    // прежний прогноз не показывается для другого события
    expect(wrapper.find('[data-player-split]').exists()).toBe(false)
    release({ price: forecastQuote(8) })
    await flushPromises()
    expect(wrapper.find('[data-player-split]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('лист записи: цена места и сумма за несколько мест — из GET …/price?seats=N', async () => {
    const one = forecastQuote(8)
    const two = forecastQuote(8, 0, 2)
    const wrapper = await renderPage()
    await wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('Записаться'))!
      .trigger('click')
    await flushPromises()
    const sheet = wrapper.get('[role="dialog"]')
    expect(sheet.text()).toContain(`≈ ${money(one.perSeat.max)}`)
    await sheet.get('[aria-label="Больше мест"]').trigger('click')
    await flushPromises()
    const call = apiFetch.mock.calls.find(([, o]) => (o?.query as { seats?: number })?.seats === 2)
    expect(call?.[0]).toContain('/events/71/price')
    expect(sheet.text()).toContain('За все места')
    expect(sheet.text()).toContain(`≈ ${money(two.total.max)}`)
    // не умножение на клиенте: 2 × цена места отличается от ответа цены
    expect(money(two.total.max)).not.toBe(money(2 * one.perSeat.max))
    wrapper.unmount()
  })

  it('fixed-событие не запрашивает прогноз split', async () => {
    data.value = {
      ...data.value,
      event: {
        ...fixture(),
        price: 1500,
        pricing: {
          ...legacyPricing(),
          mode: 'fixed',
          basis: 'fixed',
          minAmount: 1500,
          maxAmount: 1500,
          targetAmount: null,
        },
      },
    }
    const wrapper = await renderPage()
    expect(wrapper.find('[data-player-split]').exists()).toBe(false)
    expect(priceCalls()).toHaveLength(0)
    expect(wrapper.text()).toContain(money(1500))
    wrapper.unmount()
  })
})
