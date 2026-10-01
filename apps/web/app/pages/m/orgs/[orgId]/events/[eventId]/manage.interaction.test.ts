// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onUnmounted,
  reactive,
  ref,
  Suspense,
  watch,
} from 'vue'

import Manage from './manage.vue'

import EventPricingPanel from '~/components/EventPricingPanel.vue'

const managePath = '/m/orgs/30/events/71/manage'
const route = reactive({ params: { orgId: '30', eventId: '71' }, fullPath: managePath })
const routerRoute = ref({ params: { orgId: '30', eventId: '71' }, fullPath: managePath })
const event = {
  id: 71,
  organizationId: 30,
  title: 'Тренировка',
  status: 'published',
  startsAt: '2026-09-27T16:00:00.000Z',
  capacity: 2,
  taken: 1,
  waitlist: 0,
  currency: 'BYN',
  pricing: {
    mode: 'split',
    targetAmount: 10000,
    settledAt: null,
    participantCount: 1,
    minAmount: 10000,
    maxAmount: 10000,
    basis: 'current',
    myAllocatedAmount: null,
    myPaymentStatus: null,
  },
  pricingPermissions: { canChangePriceMode: false, canChangeTargetAmount: true, canSettle: true },
  pricingFinancials: { collected: 0, pending: 0, cancelled: 0, refunded: 0, currency: 'BYN' },
}
const booking = {
  id: 5,
  status: 'confirmed',
  method: 'cash',
  user: { id: 9, name: 'Игрок', telegramUsername: null, image: null },
}
const payment = {
  id: 11,
  amount: 2500,
  currency: 'BYN',
  method: 'cash',
  user: booking.user,
  event: { id: 71, title: 'Тренировка', startsAt: event.startsAt },
}
let eventData = ref({ event })
let orgData = ref({ organization: { id: 30 }, myMember: { role: 'owner', status: 'active' } })
let rosterFailure = false
let paymentsFixture: (typeof payment)[] = []
let holdPaymentPost = false
let resolvePaymentPost: (() => void) | null = null
let resolveConfirmation: ((value: boolean) => void) | null = null
const confirm = vi.fn(() => new Promise<boolean>((resolve) => (resolveConfirmation = resolve)))
const apiFetch = vi.fn(async (url: string, options?: { method?: string }) => {
  if (options?.method) {
    if (holdPaymentPost && url.endsWith('/confirm'))
      await new Promise<void>((resolve) => (resolvePaymentPost = resolve))
    return {}
  }
  if (url.endsWith('/bookings')) {
    if (rosterFailure) throw new Error('roster unavailable')
    return { bookings: [booking] }
  }
  if (url.endsWith('/payments')) return { payments: paymentsFixture }
  throw new Error(`Unexpected GET ${url}`)
})
const refreshEvent = vi.fn()

vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useRouter', () => ({ currentRoute: routerRoute }))
vi.stubGlobal('useOrgTimezone', () => ({ tz: 'Europe/Minsk' }))
vi.stubGlobal('useTelegram', () => ({ confirm, haptic: vi.fn() }))
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('apiErrorMessage', (_cause: unknown, fallback: string) => fallback)
vi.stubGlobal('apiErrorCode', () => null)
vi.stubGlobal('useFetch', (url: () => string) => {
  if (url().endsWith('/30'))
    return { data: orgData, error: ref(null), status: ref('success'), refresh: vi.fn() }
  return { data: eventData, error: ref(null), status: ref('success'), refresh: refreshEvent }
})

async function renderManage() {
  const host = defineComponent({
    render: () => h(Suspense, null, { default: () => h(Manage) }),
  })
  const wrapper = mount(host, {
    global: {
      components: { EventPricingPanel },
      stubs: {
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        VtMiniHeader: { template: '<header><slot name="right" /></header>' },
        VtChip: { template: '<span><slot /></span>' },
        VtIcon: { template: '<span />' },
        VtAvatar: { template: '<span />' },
        ErrorState: { props: ['message'], template: '<div role="alert">{{ message }}</div>' },
        EmptyState: { props: ['title'], template: '<div>{{ title }}</div>' },
        SkeletonList: { template: '<div>Loading</div>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-27T12:00:00.000Z'))
  route.params.orgId = '30'
  route.params.eventId = '71'
  route.fullPath = managePath
  routerRoute.value = { params: { orgId: '30', eventId: '71' }, fullPath: managePath }
  eventData = ref({ event })
  orgData = ref({ organization: { id: 30 }, myMember: { role: 'owner', status: 'active' } })
  rosterFailure = false
  paymentsFixture = []
  holdPaymentPost = false
  resolvePaymentPost = null
  resolveConfirmation = null
  confirm.mockClear()
  apiFetch.mockClear()
  refreshEvent.mockClear()
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('event management interactions', () => {
  it('ignores a late settlement response after leaving the full route', async () => {
    const wrapper = await renderManage()
    let resolveSettlement: (() => void) | undefined
    apiFetch.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        resolveSettlement = resolve
      })
      return {}
    })
    const button = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Закрыть запись и распределить')!
    await button.trigger('click')
    resolveConfirmation?.(true)
    await flushPromises()
    routerRoute.value.fullPath = '/m/orgs/30/events/71/edit'
    resolveSettlement?.()
    await flushPromises()
    expect(refreshEvent).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('keeps pricing after failed settlement and provides an event GET retry', async () => {
    const wrapper = await renderManage()
    apiFetch.mockRejectedValueOnce(new Error('conflict'))
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Закрыть запись и распределить')!
      .trigger('click')
    resolveConfirmation?.(true)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Обновите событие')
    expect(wrapper.text()).toContain('100,00')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Обновить событие')!
      .trigger('click')
    expect(refreshEvent).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
  it.each(['edit', 'org', 'event', 'unmount'])(
    'settlement_is_guarded_by_full_route_and_lifecycle: %s',
    async (change) => {
      const wrapper = await renderManage()
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Закрыть запись и распределить')!
        .trigger('click')
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('100'))
      if (change === 'edit') routerRoute.value.fullPath = '/m/orgs/30/events/71/edit'
      if (change === 'org')
        routerRoute.value = {
          params: { orgId: '31', eventId: '71' },
          fullPath: '/m/orgs/31/events/71/manage',
        }
      if (change === 'event')
        routerRoute.value = {
          params: { orgId: '30', eventId: '72' },
          fullPath: '/m/orgs/30/events/72/manage',
        }
      if (change === 'unmount') wrapper.unmount()
      resolveConfirmation?.(true)
      await flushPromises()
      expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toEqual([])
      if (change !== 'unmount') wrapper.unmount()
    },
  )
  it('coalesces double settlement confirmation into one POST and cancel sends none', async () => {
    const wrapper = await renderManage()
    const settle = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Закрыть запись и распределить')!
    await settle.trigger('click')
    await settle.trigger('click')
    expect(confirm).toHaveBeenCalledTimes(1)
    resolveConfirmation?.(false)
    await flushPromises()
    expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toEqual([])
    await settle.trigger('click')
    resolveConfirmation?.(true)
    await flushPromises()
    expect(
      apiFetch.mock.calls.filter(
        ([url, options]) => url.endsWith('/settle') && options?.method === 'POST',
      ),
    ).toHaveLength(1)
    wrapper.unmount()
  })
  it('offers attendance marking after the event starts and hides future-only controls', async () => {
    vi.setSystemTime(new Date('2027-09-27T20:00:00.000Z'))
    const wrapper = await renderManage()
    expect(wrapper.find('button[aria-label="Был"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Не пришёл"]').exists()).toBe(true)
    expect(wrapper.findAll('button').some((button) => button.text() === 'Отменить событие')).toBe(
      false,
    )
    await wrapper.get('button[aria-label="Был"]').trigger('click')
    await flushPromises()
    expect(
      apiFetch.mock.calls.some(
        ([url, options]) => url.endsWith('/attendance') && options?.method === 'POST',
      ),
    ).toBe(true)
    wrapper.unmount()
  })

  it('does not cancel a different event after the route changes during confirmation', async () => {
    const wrapper = await renderManage()
    const cancel = wrapper.findAll('button').find((button) => button.text() === 'Отменить событие')
    expect(cancel).toBeDefined()
    await cancel!.trigger('click')
    expect(confirm).toHaveBeenCalled()
    route.params.eventId = '72'
    await nextTick()
    resolveConfirmation?.(true)
    await flushPromises()
    expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toEqual([])
    wrapper.unmount()
  })

  it('does not remove a booking through another organization after confirmation', async () => {
    const wrapper = await renderManage()
    await wrapper.get('button[aria-label="Снять с события"]').trigger('click')
    expect(confirm).toHaveBeenCalled()
    route.params.orgId = '31'
    await nextTick()
    resolveConfirmation?.(true)
    await flushPromises()
    expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toEqual([])
    wrapper.unmount()
  })

  it('does not act from an old page instance after the router navigates to another event', async () => {
    const wrapper = await renderManage()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отменить событие')!
      .trigger('click')
    routerRoute.value = {
      params: { orgId: '30', eventId: '72' },
      fullPath: '/m/orgs/30/events/72/manage',
    }
    await nextTick()
    resolveConfirmation?.(true)
    await flushPromises()
    expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toEqual([])
    wrapper.unmount()
  })

  it('does not cancel the event after leaving manage for edit with the same ids', async () => {
    const wrapper = await renderManage()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отменить событие')!
      .trigger('click')
    expect(confirm).toHaveBeenCalled()
    routerRoute.value = {
      params: { orgId: '30', eventId: '71' },
      fullPath: '/m/orgs/30/events/71/edit',
    }
    resolveConfirmation?.(true)
    await flushPromises()
    expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toEqual([])
    wrapper.unmount()
  })

  it('does not reject a payment after the manage page unmounts during confirmation', async () => {
    paymentsFixture = [payment]
    const wrapper = await renderManage()
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === 'Оплаты')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отклонить')!
      .trigger('click')
    expect(confirm).toHaveBeenCalled()
    wrapper.unmount()
    resolveConfirmation?.(true)
    await flushPromises()
    expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toEqual([])
  })

  it('keeps edit, publish, and cancel available when only the roster GET fails', async () => {
    rosterFailure = true
    eventData = ref({ event: { ...event, status: 'draft' } })
    const wrapper = await renderManage()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось загрузить состав')
    expect(wrapper.get('a[href="/m/orgs/30/events/71/edit"]')).toBeTruthy()
    expect(wrapper.findAll('button').some((button) => button.text() === 'Опубликовать')).toBe(true)
    expect(wrapper.findAll('button').some((button) => button.text() === 'Отменить событие')).toBe(
      true,
    )
    wrapper.unmount()
  })

  it('blocks event cancellation while a payment confirmation is in flight', async () => {
    paymentsFixture = [payment]
    holdPaymentPost = true
    const wrapper = await renderManage()
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === 'Оплаты')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Подтвердить')!
      .trigger('click')
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === 'Состав')!
      .trigger('click')
    const cancel = wrapper.findAll('button').find((button) => button.text() === 'Отменить событие')!
    expect(cancel.attributes('disabled')).toBeDefined()
    resolvePaymentPost?.()
    await flushPromises()
    wrapper.unmount()
  })

  it('blocks payment confirmation while event cancellation awaits its prompt', async () => {
    paymentsFixture = [payment]
    const wrapper = await renderManage()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отменить событие')!
      .trigger('click')
    expect(confirm).toHaveBeenCalled()
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === 'Оплаты')!
      .trigger('click')
    const pay = wrapper.findAll('button').find((button) => button.text() === 'Подтвердить')!
    expect(pay.attributes('disabled')).toBeDefined()
    resolveConfirmation?.(false)
    await flushPromises()
    wrapper.unmount()
  })
})
