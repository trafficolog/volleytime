// @vitest-environment happy-dom
import { quoteEventPrice } from '@volley-time/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, Suspense, watch } from 'vue'

import DesktopEvent from './index.vue'

import EventPriceBlock from '~/components/EventPriceBlock.vue'
import EventPricingPanel from '~/components/EventPricingPanel.vue'
import OrganizerRosterRow from '~/components/OrganizerRosterRow.vue'
import VtAlert from '~/components/vt/Alert.vue'
import VtChip from '~/components/vt/Chip.vue'
import VtIcon from '~/components/vt/Icon.vue'
import SeatsMini from '~/components/vt/SeatsMini.vue'
import StateChip from '~/components/vt/StateChip.vue'
import { formatMoneyRu } from '~/utils/labels'

const path = '/app/orgs/30/events/71'
const route = reactive({ params: { orgId: '30', eventId: '71' }, path, fullPath: path })
const routerRoute = ref({ params: { orgId: '30', eventId: '71' }, path, fullPath: path })

const splitEvent = (over: Record<string, unknown> = {}) => ({
  id: 71,
  organizationId: 30,
  title: 'Основа',
  startsAt: '2099-10-01T12:00:00Z',
  endsAt: '2099-10-01T14:00:00Z',
  status: 'published',
  capacity: 14,
  taken: 8,
  players: 6,
  waitlist: 2,
  currency: 'BYN',
  price: 0,
  level: null,
  seriesId: null,
  venue: { name: 'Школа 24' },
  // readEventPricing намеренно «врёт»: интерфейс не должен брать цену из него
  pricing: {
    mode: 'split',
    targetAmount: 10000,
    settledAt: null,
    participantCount: 3,
    minAmount: 111,
    maxAmount: 222,
    basis: 'current',
    myAllocatedAmount: null,
    myPaymentStatus: null,
  },
  pricingPermissions: { canChangePriceMode: false, canChangeTargetAmount: true, canSettle: true },
  ...over,
})

const booking = (over: Record<string, unknown> = {}) => ({
  id: 1,
  eventId: 71,
  status: 'confirmed',
  method: 'cash',
  seats: 1,
  waitlistSeats: 0,
  bookedAt: '2026-10-01T00:00:00Z',
  confirmedAt: null,
  subscriptionId: null,
  paymentId: null,
  user: { id: 100, name: 'Артём', telegramUsername: null, image: null },
  ...over,
})

let current = splitEvent()
let rosterPayload: { user: { id: number }; level?: string | null }[] | undefined
let bookingsPayload: ReturnType<typeof booking>[] = []
let quotePayload: unknown = null
const refresh = vi.fn()
const apiFetch = vi.fn(async (url: string, opts?: { method?: string }) => {
  if (opts?.method) return {}
  if (url.endsWith('/price')) return { price: quotePayload }
  return { bookings: bookingsPayload }
})
const windowConfirm = vi.fn(() => true)

Object.entries({
  computed,
  ref,
  watch,
  onBeforeUnmount,
  useRoute: () => route,
  useRouter: () => ({ currentRoute: routerRoute }),
  definePageMeta: () => undefined,
  useOrgTimezone: () => ({ tz: ref('Europe/Minsk') }),
  useFetch: async (url: unknown) => {
    const target = typeof url === 'function' ? (url as () => string)() : (url as string)
    if (target === '/api/levels')
      return {
        data: ref({ levels: [{ code: 'v2', title: 'В2', description: '', sortOrder: 2 }] }),
      }
    return {
      data: ref({ event: current, roster: rosterPayload }),
      pending: ref(false),
      error: ref(null),
      refresh,
    }
  },
  $fetch: apiFetch,
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
  apiErrorCode: () => undefined,
}).forEach(([key, value]) => vi.stubGlobal(key, value))

async function render() {
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(DesktopEvent) }) }),
    {
      attachTo: document.body,
      global: {
        components: {
          EventPriceBlock,
          EventPricingPanel,
          OrganizerRosterRow,
          VtAlert,
          VtChip,
          VtIcon,
          VtSeatsMini: SeatsMini,
          VtStateChip: StateChip,
        },
        stubs: {
          NuxtLink: { template: '<a><slot /></a>' },
          VtAvatar: true,
          SkeletonList: true,
          ErrorState: true,
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

const posts = () => apiFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')

beforeEach(() => {
  Object.assign(route, { params: { orgId: '30', eventId: '71' }, path, fullPath: path })
  routerRoute.value = { params: { orgId: '30', eventId: '71' }, path, fullPath: path }
  vi.stubGlobal('confirm', windowConfirm)
  windowConfirm.mockReset().mockReturnValue(true)
  apiFetch.mockClear()
  refresh.mockClear()
  current = splitEvent()
  rosterPayload = undefined
  bookingsPayload = []
  quotePayload = quoteEventPrice({
    mode: 'split',
    targetAmount: 10000,
    capacity: 14,
    takenSeats: 8,
    mySeats: 0,
    seats: 1,
    settled: null,
  })
  document.body.innerHTML = ''
})

describe('W-05: цена только из GET …/price', () => {
  it('показанная цена и прогноз совпадают с ответом эндпоинта для тех же мест, а не с readEventPricing', async () => {
    const quote = quoteEventPrice({
      mode: 'split',
      targetAmount: 10000,
      capacity: 14,
      takenSeats: 8,
      mySeats: 0,
      seats: 1,
      settled: null,
    })
    const wrapper = await render()
    const priceCall = apiFetch.mock.calls.find(([url]) => url.endsWith('/events/71/price'))
    expect(priceCall).toBeDefined()
    expect(priceCall![1]).toMatchObject({ query: { seats: 1 } })
    expect(wrapper.get('[data-price-headline]').text()).toBe(
      `≈ ${formatMoneyRu(quote.perSeat.max, 'BYN')}`,
    )
    expect(wrapper.get('[data-price-range]').text()).toBe(
      `от ${formatMoneyRu(quote.perSeat.min, 'BYN')} до ${formatMoneyRu(quote.perSeat.max, 'BYN')}`,
    )
    expect(wrapper.get('[data-price-param]').text()).toBe(
      `≈ ${formatMoneyRu(quote.perSeat.max, 'BYN')}`,
    )
    // значения readEventPricing (1,11 / 2,22 BYN) нигде не показываются
    expect(wrapper.text()).not.toContain('1,11')
    expect(wrapper.text()).not.toContain('2,22')
    wrapper.unmount()
  })

  it('отменённое событие: цена не запрашивается и не показывается', async () => {
    current = splitEvent({ status: 'cancelled' })
    const wrapper = await render()
    expect(apiFetch.mock.calls.some(([url]) => url.endsWith('/price'))).toBe(false)
    expect(wrapper.find('[data-price-headline]').exists()).toBe(false)
    expect(wrapper.find('[data-price-param]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('«мест нет» — по занятости события', async () => {
    current = splitEvent({ taken: 14, capacity: 14 })
    quotePayload = quoteEventPrice({
      mode: 'split',
      targetAmount: 10000,
      capacity: 14,
      takenSeats: 14,
      mySeats: 0,
      seats: 1,
      settled: null,
    })
    const wrapper = await render()
    expect(wrapper.text()).toContain('мест нет')
    wrapper.unmount()
  })
})

describe('W-05: состав', () => {
  it('«+N», очередь у записи в основе, уровень только из ответа для участников группы', async () => {
    bookingsPayload = [
      booking({
        id: 1,
        seats: 3,
        user: { id: 100, name: 'Маша', telegramUsername: null, image: null },
      }),
      booking({
        id: 2,
        waitlistSeats: 2,
        user: { id: 101, name: 'Игорь', telegramUsername: null, image: null },
      }),
      booking({
        id: 3,
        status: 'waitlisted',
        user: { id: 102, name: 'Лера', telegramUsername: null, image: null },
      }),
    ]
    rosterPayload = [
      { user: { id: 100 }, level: 'v2' },
      { user: { id: 101 }, level: null },
    ]
    const wrapper = await render()
    const rows = wrapper.findAllComponents(OrganizerRosterRow)
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('+2')
    expect(rows[0]!.text()).toContain('3 места')
    expect(rows[0]!.find('.vt-roster-row__level').text()).toBe('В2')
    expect(rows[1]!.text()).toContain('ещё 2 в очереди')
    expect(rows[1]!.find('.vt-roster-row__level').exists()).toBe(false)
    // без ответа для участников группы уровня нет вовсе
    expect(rows[2]!.find('.vt-roster-row__level').exists()).toBe(false)
    expect(wrapper.get('#desktop-waitlist-title').text()).toContain('2 места')
    wrapper.unmount()
  })

  it('подтверждение и отклонение оплаты идут по paymentId записи', async () => {
    bookingsPayload = [booking({ id: 1, status: 'pending_payment', paymentId: 55, method: 'cash' })]
    const wrapper = await render()
    await wrapper.get('[aria-label^="Подтвердить оплату"]').trigger('click')
    await flushPromises()
    expect(posts().map(([url]) => url)).toEqual(['/api/organizations/30/payments/55/confirm'])
    apiFetch.mockClear()
    await wrapper.get('[aria-label^="Отклонить оплату"]').trigger('click')
    await flushPromises()
    expect(windowConfirm).toHaveBeenCalled()
    expect(posts().map(([url]) => url)).toEqual(['/api/organizations/30/payments/55/reject'])
    wrapper.unmount()
  })
})

describe('W-05: отмена события', () => {
  it('требует подтверждения и показывает последствия; запрос только после «Отменить событие» в диалоге', async () => {
    bookingsPayload = [booking({ id: 1, paymentId: 5 }), booking({ id: 2, status: 'waitlisted' })]
    const wrapper = await render()
    const trigger = wrapper.findAll('button').find((b) => b.text() === 'Отменить событие')!
    await trigger.trigger('click')
    await flushPromises()
    expect(posts()).toHaveLength(0)
    const dialog = document.body.querySelector('[role="alertdialog"]')!
    expect(dialog).not.toBeNull()
    const text = dialog.textContent!
    expect(text).toContain('Записи будут отменены: 2')
    expect(text).toContain('уведомление')
    expect(text).toContain('Баланс событий не возвращается')
    const confirmBtn = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent!.trim() === 'Отменить событие',
    )!
    confirmBtn.click()
    await flushPromises()
    expect(posts().map(([url]) => url)).toEqual(['/api/organizations/30/events/71/cancel'])
    wrapper.unmount()
  })

  it('«Не отменять» закрывает диалог без запроса', async () => {
    const wrapper = await render()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Отменить событие')!
      .trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="alertdialog"]')!
    ;[...dialog.querySelectorAll('button')]
      .find((b) => b.textContent!.trim() === 'Не отменять')!
      .click()
    await flushPromises()
    expect(posts()).toHaveLength(0)
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
    wrapper.unmount()
  })
})
