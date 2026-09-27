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
const apiFetch = vi.fn(
  async (
    url: string,
    options?: { method?: string; body?: unknown; query?: { type?: string; limit?: number } },
  ) => {
    if (options?.method === 'POST') return {}
    if (url.endsWith('/events')) return { events: [] }
    if (failure) throw { statusCode: failure }
    return {
      balance,
      entries: entries
        .filter((item) => !options?.query?.type || item.type === options.query.type)
        .slice(0, options?.query?.limit ?? 50),
    }
  },
)

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
    attachTo: document.body,
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
  it('keeps the focused filter and operation controls mounted during a same-org refresh', async () => {
    const wrapper = await renderCashbox()
    let release!: (value: { balance: typeof balance; entries: typeof entries }) => void
    const pending = new Promise<{ balance: typeof balance; entries: typeof entries }>((resolve) => {
      release = resolve
    })
    apiFetch.mockImplementationOnce(async () => pending)
    const filter = wrapper.get('#ledger-type')
    const filterElement = filter.element as HTMLSelectElement
    filterElement.focus()
    await filter.setValue('expense')
    await nextTick()
    expect(filterElement.isConnected).toBe(true)
    expect(document.activeElement).toBe(filterElement)
    expect(wrapper.find('.cashbox-operation-actions').findAll('button')).toHaveLength(2)
    expect(wrapper.text()).toContain('40,00 BYN')
    release({ balance, entries: [entry] })
    await flushPromises()
    expect(document.activeElement).toBe(filterElement)
    wrapper.unmount()
  })

  it('makes an older expense reachable after 200 newer incomes through the journal filter', async () => {
    entries = [
      ...Array.from({ length: 200 }, (_, index) => ({
        ...entry,
        id: 201 - index,
        type: 'income',
        category: 'contribution',
        description: `Новый доход ${index}`,
      })),
      { ...entry, description: 'Старый расход', occurredAt: '2026-09-25T10:00:00.000Z' },
    ]
    const wrapper = await renderCashbox()
    expect(wrapper.text()).not.toContain('Старый расход')

    const filter = wrapper.find('#ledger-type')
    expect(filter.exists()).toBe(true)
    await filter.setValue('expense')
    await flushPromises()

    expect(wrapper.text()).toContain('Старый расход')
    expect(
      apiFetch.mock.calls.some(
        ([url, options]) =>
          url.endsWith('/ledger') &&
          options?.query?.type === 'expense' &&
          options.query.limit === 200,
      ),
    ).toBe(true)
    wrapper.unmount()
  })

  it('clears a filtered journal on organization switch and ignores its stale response after 403', async () => {
    const wrapper = await renderCashbox()
    let resolveStale!: (value: { balance: typeof balance; entries: typeof entries }) => void
    const stale = new Promise<{ balance: typeof balance; entries: typeof entries }>((resolve) => {
      resolveStale = resolve
    })
    apiFetch.mockImplementationOnce(async () => stale)

    await wrapper.find('#ledger-type').setValue('expense')
    route.params.orgId = '31'
    failure = 403
    await nextTick()
    await flushPromises()
    resolveStale({ balance, entries: [{ ...entry, description: 'Чужой расход' }] })
    await flushPromises()

    expect(
      apiFetch.mock.calls.some(
        ([url, options]) => url.includes('/31/ledger') && !options?.query?.type,
      ),
    ).toBe(true)
    expect(wrapper.text()).toContain('Касса доступна организаторам')
    expect(wrapper.text()).not.toContain('Чужой расход')
    expect(wrapper.text()).not.toContain('40,00 BYN')
    wrapper.unmount()
  })

  it('places equal neutral operation actions directly before the day journal', async () => {
    const wrapper = await renderCashbox()
    const actions = wrapper.find('.cashbox-operation-actions')
    const buttons = actions.findAll('button')
    expect(buttons.map((button) => button.text())).toEqual(['Расход', 'Поступление'])
    expect(buttons.every((button) => button.classes().includes('vt-btn--ghost'))).toBe(true)
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(actions.element.nextElementSibling?.textContent).toContain('Журнал')
    wrapper.unmount()
  })

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
