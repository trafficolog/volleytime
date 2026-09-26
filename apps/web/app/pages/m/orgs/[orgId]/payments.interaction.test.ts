// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, reactive, ref, Suspense, watch } from 'vue'

import Payments from './payments.vue'

const route = reactive({ params: { orgId: '30' } })
const payer = { id: 9, name: 'Игрок', telegramUsername: null, image: null }
const payment = {
  id: 11,
  amount: 2500,
  currency: 'BYN',
  method: 'online',
  createdAt: '2026-09-26T10:00:00.000Z',
  user: payer,
  event: { id: 71, title: 'Тренировка', startsAt: '2026-09-27T16:00:00.000Z' },
  plan: null,
}
let pending: (typeof payment)[] = []
let getFailure = 0
let postError: string | null = null
let holdPost = false
let releasePost: (() => void) | null = null
const apiFetch = vi.fn(async (_url: string, options?: { method?: string }) => {
  if (options?.method === 'POST') {
    if (holdPost) await new Promise<void>((resolve) => (releasePost = resolve))
    if (postError) throw { code: postError }
    return {}
  }
  if (getFailure) throw { statusCode: getFailure }
  return { payments: pending }
})

vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
vi.stubGlobal('useTelegram', () => ({ confirm: vi.fn(async () => true), haptic: vi.fn() }))
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('apiErrorStatus', (e: { statusCode?: number }) => e.statusCode)
vi.stubGlobal('apiErrorCode', (e: { code?: string }) => e.code)
vi.stubGlobal('apiErrorMessage', () => 'Сбой загрузки')

async function renderPayments() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Payments) }) })
  const wrapper = mount(host, {
    global: {
      stubs: {
        VtMiniHeader: { template: '<header />' },
        VtAvatar: { template: '<span />' },
        VtChip: { template: '<span><slot /></span>' },
        VtIcon: { template: '<span />' },
        SkeletonList: { template: '<div>Загрузка</div>' },
        EmptyState: { props: ['title'], template: '<div>{{ title }}</div>' },
        ErrorState: { props: ['message'], template: '<div role="alert">{{ message }}</div>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  route.params.orgId = '30'
  pending = [{ ...payment }]
  getFailure = 0
  postError = null
  holdPost = false
  releasePost = null
  apiFetch.mockClear()
})

describe('general pending payment queue', () => {
  it('shows the actual online method and keeps currency totals separate', async () => {
    pending = [{ ...payment }, { ...payment, id: 12, amount: 3000, currency: 'EUR' }]
    const wrapper = await renderPayments()
    expect(wrapper.text()).toContain('Онлайн')
    expect(wrapper.text()).toContain('25,00 BYN')
    expect(wrapper.text()).toContain('30,00 EUR')
    wrapper.unmount()
  })

  it('clears the old queue and blocks its actions during an organization switch', async () => {
    const wrapper = await renderPayments()
    route.params.orgId = '31'
    getFailure = 403
    await nextTick()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Игрок')
    expect(
      wrapper.findAll('button').filter((button) => button.text().includes('Подтвердить')),
    ).toHaveLength(0)
    expect(wrapper.text()).toContain('Подтверждать оплаты могут организаторы')
    wrapper.unmount()
  })

  it('allows only one payment action while a POST is in flight', async () => {
    pending = [
      { ...payment, method: 'cash' },
      { ...payment, id: 12, method: 'cash' },
    ]
    holdPost = true
    const wrapper = await renderPayments()
    const buttons = wrapper
      .findAll('button')
      .filter((button) => button.text().includes('Подтвердить'))
    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
    releasePost?.()
    await flushPromises()
    wrapper.unmount()
  })

  it('refreshes the pending queue after an already processed conflict', async () => {
    postError = 'payment.not_pending'
    const wrapper = await renderPayments()
    pending = []
    const confirm = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Подтвердить'))
    await confirm!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Платёж уже обработан — список обновлён')
    expect(wrapper.text()).not.toContain('Игрок')
    wrapper.unmount()
  })
})
