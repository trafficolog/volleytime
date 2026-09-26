// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, reactive, ref, Suspense, watch } from 'vue'

import Cashbox from './cashbox.vue'

const route = reactive({ params: { orgId: '30' } })
const balance = {
  currency: 'BYN',
  income: 5000,
  expense: 1000,
  balance: 4000,
  byCurrency: {
    BYN: { income: 5000, expense: 1000, balance: 4000 },
    EUR: { income: 700, expense: 100, balance: 600 },
  },
}
const entry = {
  id: 1,
  type: 'expense',
  category: 'rent',
  amount: 1000,
  currency: 'BYN',
  description: 'Зал',
  occurredAt: '2026-09-26T10:00:00.000Z',
  event: null,
  author: { name: 'Организатор', telegramUsername: null },
  payer: null,
}
let failure = 0
let entries = [entry]
const apiFetch = vi.fn(async (url: string, options?: { method?: string; body?: unknown }) => {
  if (options?.method === 'POST') return {}
  if (url.endsWith('/events')) return { events: [] }
  if (failure) throw { statusCode: failure }
  return { balance, entries }
})

vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
vi.stubGlobal('useTelegram', () => ({ haptic: vi.fn() }))
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('watch', watch)
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('apiErrorStatus', (e: { statusCode?: number }) => e.statusCode)
vi.stubGlobal('apiErrorMessage', () => 'Сбой загрузки')

async function renderCashbox() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Cashbox) }) })
  const wrapper = mount(host, {
    global: {
      stubs: {
        VtMiniHeader: { template: '<header />' },
        VtIcon: { template: '<span />' },
        VtSheet: {
          props: ['modelValue'],
          template: '<div v-if="modelValue"><slot /></div>',
        },
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
  failure = 0
  entries = [entry]
  apiFetch.mockClear()
})

describe('append-only cashbox', () => {
  it('shows the primary balance and other currency separately with a day journal', async () => {
    const wrapper = await renderCashbox()
    expect(wrapper.text()).toContain('40,00 BYN')
    expect(wrapper.text()).toContain('6,00 EUR')
    expect(wrapper.text()).toContain('Аренда')
    expect(wrapper.text()).not.toMatch(/Редактировать|Удалить/)
    wrapper.unmount()
  })

  it('clears old organization balance and journal on a forbidden switch', async () => {
    const wrapper = await renderCashbox()
    route.params.orgId = '31'
    failure = 403
    await nextTick()
    await flushPromises()
    expect(wrapper.text()).toContain('Касса доступна организаторам')
    expect(wrapper.text()).not.toContain('40,00 BYN')
    expect(wrapper.text()).not.toContain('Аренда')
    wrapper.unmount()
  })

  it('validates a positive amount and refreshes after one saved expense', async () => {
    const wrapper = await renderCashbox()
    const expense = wrapper.findAll('button').find((button) => button.text().includes('Расход'))
    await expense!.trigger('click')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Введите сумму больше нуля')
    expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
    await wrapper.find('#lg-amount').setValue('12,50')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const post = apiFetch.mock.calls.find(([, options]) => options?.method === 'POST')
    expect(post?.[0]).toBe('/api/organizations/30/ledger/expense')
    expect(post?.[1]?.body).toMatchObject({ category: 'rent', amount: 1250 })
    expect(apiFetch.mock.calls.filter(([url]) => url.endsWith('/ledger'))).toHaveLength(2)
    wrapper.unmount()
  })
})
