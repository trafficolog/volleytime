// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, reactive, ref, Suspense, watch } from 'vue'

import Manage from './manage.vue'

const route = reactive({ params: { orgId: '30', eventId: '71' } })
const routerRoute = ref({ params: { orgId: '30', eventId: '71' } })
const event = {
  id: 71,
  organizationId: 30,
  title: 'Тренировка',
  status: 'published',
  startsAt: '2026-09-27T16:00:00.000Z',
  capacity: 2,
  taken: 1,
  waitlist: 0,
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

vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useRouter', () => ({ currentRoute: routerRoute }))
vi.stubGlobal('useOrgTimezone', () => ({ tz: 'Europe/Minsk' }))
vi.stubGlobal('useTelegram', () => ({ confirm, haptic: vi.fn() }))
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('apiErrorMessage', () => 'Не удалось загрузить состав')
vi.stubGlobal('apiErrorCode', () => null)
vi.stubGlobal('useFetch', (url: () => string) => {
  if (url().endsWith('/30'))
    return { data: orgData, error: ref(null), status: ref('success'), refresh: vi.fn() }
  return { data: eventData, error: ref(null), status: ref('success'), refresh: vi.fn() }
})

async function renderManage() {
  const host = defineComponent({
    render: () => h(Suspense, null, { default: () => h(Manage) }),
  })
  const wrapper = mount(host, {
    global: {
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
  route.params.orgId = '30'
  route.params.eventId = '71'
  routerRoute.value = { params: { orgId: '30', eventId: '71' } }
  eventData = ref({ event })
  orgData = ref({ organization: { id: 30 }, myMember: { role: 'owner', status: 'active' } })
  rosterFailure = false
  paymentsFixture = []
  holdPaymentPost = false
  resolvePaymentPost = null
  resolveConfirmation = null
  confirm.mockClear()
  apiFetch.mockClear()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('event management interactions', () => {
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
    routerRoute.value = { params: { orgId: '30', eventId: '72' } }
    await nextTick()
    resolveConfirmation?.(true)
    await flushPromises()
    expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toEqual([])
    wrapper.unmount()
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
