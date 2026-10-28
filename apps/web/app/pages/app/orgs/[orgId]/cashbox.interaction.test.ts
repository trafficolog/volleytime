// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  Suspense,
  watch,
} from 'vue'

import Cashbox from './cashbox.vue'

import Icon from '~/components/vt/Icon.vue'
import Segment from '~/components/vt/Segment.vue'
import { useDesktopFinanceTimezone } from '~/composables/useDesktopFinanceTimezone'

const route = reactive({
  params: { orgId: '30' },
  path: '/app/orgs/30/cashbox',
  fullPath: '/app/orgs/30/cashbox',
})
const balance = {
  currency: 'BYN',
  income: 31850,
  expense: 7000,
  balance: 24850,
  byCurrency: { BYN: { income: 31850, expense: 7000, balance: 24850 } },
}
const entry = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'income',
  category: 'payment_income',
  amount: 1500,
  currency: 'BYN',
  description: null,
  method: 'cash',
  occurredAt: '2026-05-28T10:00:00Z',
  event: { id: 1, title: 'Основа', startsAt: '2026-05-28T16:00:00Z' },
  author: null,
  payer: { name: 'Никита', telegramUsername: null },
  ...extra,
})
const calls: {
  url: string
  opts?: { method?: string; query?: Record<string, unknown>; body?: unknown }
}[] = []
let period = { income: 31850, expense: 7000, currency: 'BYN' }
let ledgerEntries: ReturnType<typeof entry>[] = []
const request = vi.fn(async (url: string, opts?: never) => {
  calls.push({ url, opts })
  if (url === '/api/organizations/30') return { organization: { defaultTimezone: 'Europe/Minsk' } }
  if (url === '/api/organizations/30/ledger')
    return {
      balance,
      period,
      awaiting: { amount: 1500, count: 1, currency: 'BYN' },
      entries: ledgerEntries,
    }
  if (url === '/api/organizations/30/events') return { events: [] }
  return { entry: { id: 99 } }
})

Object.entries({
  computed,
  ref,
  reactive,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  useRoute: () => route,
  definePageMeta: () => undefined,
  useRequestFetch: () => request,
  useDesktopFinanceTimezone,
  apiErrorStatus: () => undefined,
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}).forEach(([key, value]) => vi.stubGlobal(key, value))

async function render() {
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Cashbox) }) }),
    {
      attachTo: document.body,
      global: {
        components: { VtIcon: Icon, VtSegment: Segment },
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          ErrorState: true,
          EmptyState: true,
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  calls.length = 0
  ledgerEntries = [
    entry(1),
    entry(2, {
      type: 'expense',
      category: 'rent',
      amount: 4200,
      method: null,
      payer: null,
      description: 'Аренда Школа №24',
      event: null,
    }),
  ]
  route.path = '/app/orgs/30/cashbox'
  period = { income: 31850, expense: 7000, currency: 'BYN' }
})

describe('desktop cashbox v3', () => {
  it('shows the server figures: balance, income, expense and awaiting (debts)', async () => {
    const wrapper = await render()
    const text = (id: string) => wrapper.get(`[data-testid="${id}"]`).text().replace(/\s/g, ' ')
    expect(text('cashbox-balance')).toBe('+248,50 BYN')
    expect(text('cashbox-income')).toBe('+318,50 BYN')
    expect(text('cashbox-expense')).toBe('−70,00 BYN')
    expect(text('cashbox-awaiting')).toBe('15,00 BYN')
    expect(wrapper.text()).toContain('Никита · Основа')
    expect(wrapper.text()).toContain('Наличные')
    expect(wrapper.text()).toContain('Аренда Школа №24')
  })

  it('refetches with type, category and period filters and keeps export in sync', async () => {
    const wrapper = await render()
    await wrapper.get('[aria-label="Тип операций"]').findAll('[role="radio"]')[2]!.trigger('click')
    await flushPromises()
    expect(calls.at(-1)!.opts!.query).toMatchObject({ type: 'expense', limit: 50, offset: 0 })
    await wrapper.get('input[type="month"]').setValue('2026-05')
    await flushPromises()
    expect(calls.at(-1)!.opts!.query).toMatchObject({
      type: 'expense',
      from: '2026-04-30T21:00:00.000Z',
      to: '2026-05-31T21:00:00.000Z',
    })
    const href = wrapper.get('[data-testid="cashbox-export"]').attributes('href')!
    expect(href).toContain('/api/organizations/30/ledger/export?')
    expect(href).toContain('type=expense')
    expect(href).toContain('from=2026-04-30T21%3A00%3A00.000Z')
  })

  it('refuses to save a manual operation without a comment, then sends the trimmed comment', async () => {
    const wrapper = await render()
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Запись'))!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Новое поступление')
    await wrapper.get('input[inputmode="decimal"]').setValue('15')
    expect(wrapper.get('[data-testid="cashbox-after"]').text()).toBe('+263,50 BYN')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Укажите комментарий к операции.')
    expect(calls.some((c) => c.opts?.method === 'POST')).toBe(false)

    await wrapper.get('textarea').setValue('  Доплата за гостя ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const post = calls.find((c) => c.opts?.method === 'POST')!
    expect(post.url).toBe('/api/organizations/30/ledger/income')
    expect(post.opts!.body).toMatchObject({
      category: 'contribution',
      amount: 1500,
      description: 'Доплата за гостя',
    })
  })

  it('switches to an expense and previews the lower balance', async () => {
    const wrapper = await render()
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Запись'))!
      .trigger('click')
    await flushPromises()
    await wrapper.get('[aria-label="Тип записи"]').findAll('[role="radio"]')[1]!.trigger('click')
    await wrapper.get('input[inputmode="decimal"]').setValue('42')
    expect(wrapper.text()).toContain('Новый расход')
    expect(wrapper.get('[data-testid="cashbox-after"]').text()).toBe('+206,50 BYN')
  })

  it('scopes income and expense tiles to the selected month and keeps the balance all-time', async () => {
    const wrapper = await render()
    const text = (id: string) => wrapper.get(`[data-testid="${id}"]`).text().replace(/\s/g, ' ')
    expect(wrapper.text()).toContain('Поступило · за всё время')
    period = { income: 3000, expense: 1000, currency: 'BYN' }
    await wrapper.get('input[type="month"]').setValue('2026-05')
    await flushPromises()
    expect(text('cashbox-income')).toBe('+30,00 BYN')
    expect(text('cashbox-expense')).toBe('−10,00 BYN')
    expect(text('cashbox-balance')).toBe('+248,50 BYN')
    expect(wrapper.text()).toContain('Поступило · май 2026')
    expect(wrapper.text()).toContain('Списано · май 2026')
  })
})
