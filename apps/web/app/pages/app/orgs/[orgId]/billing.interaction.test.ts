// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { minskToday } from '@volley-time/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, Suspense, watch } from 'vue'

import Billing from './billing.vue'

import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'

const route = reactive({ params: { orgId: '30' }, path: '/app/orgs/30/billing' })
const apiFetch = vi.fn()
let wrapper: VueWrapper | undefined
let role = 'owner'

const PACKAGES = [
  { code: 'events_10', units: 10, amount: 5000, currency: 'BYN', popular: false },
  { code: 'events_30', units: 30, amount: 12000, currency: 'BYN', popular: true },
  {
    code: 'events_100',
    units: 100,
    amount: 35000,
    currency: 'BYN',
    popular: false,
    badge: 'discount',
  },
]

function summary(over: Record<string, unknown> = {}) {
  return {
    eventBalance: {
      balance: 32,
      lowThreshold: 10,
      low: false,
      packages: PACKAGES,
      pendingRequests: [],
      ...over,
    },
  }
}

function entry(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    delta: -1,
    reason: 'spend',
    balanceAfter: 31,
    actorKind: 'user',
    author: { id: 5, name: 'Организатор' },
    source: null,
    comment: null,
    event: { id: 9, title: 'Основа · 28 мая', startsAt: '2026-05-28T16:00:00.000Z' },
    purchaseRequestId: null,
    createdAt: '2026-05-25T10:00:00.000Z',
    ...over,
  }
}

let balanceBody: unknown
let entriesBody: (cursor?: string) => unknown

beforeEach(() => {
  role = 'owner'
  balanceBody = summary()
  entriesBody = () => ({
    entries: [entry(1), entry(2, { reason: 'refund', delta: 1 })],
    nextCursor: null,
  })
  apiFetch
    .mockReset()
    .mockImplementation(
      async (url: string, opts?: { method?: string; query?: { cursor?: string } }) => {
        if (url === '/api/organizations/30/event-balance' && !opts?.method) return balanceBody
        if (url === '/api/organizations/30/event-balance/entries')
          return entriesBody(opts?.query?.cursor)
        if (url === '/api/organizations/30/event-balance/purchase-requests') {
          return { purchaseRequest: { id: 1 } }
        }
        throw new Error(`unexpected ${url}`)
      },
    )
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useFetch', async () => ({
    data: ref({
      organization: { id: 30, defaultTimezone: 'Europe/Minsk' },
      myMember: { role, status: 'active' },
    }),
  }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
  vi.stubGlobal('$fetch', apiFetch)
  vi.stubGlobal('apiErrorMessage', (e: { message?: string }, fallback: string) =>
    e.message ? e.message : fallback,
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Billing) }) }),
    { attachTo: document.body, global: { components: { ErrorState, SkeletonList } } },
  )
  await flushPromises()
  return wrapper
}

const byText = (w: VueWrapper, text: string) =>
  w.findAll('button').find((b) => b.text().trim() === text)

describe('desktop balance and billing (W-12)', () => {
  it('shows the balance, the packages with prices and the history', async () => {
    const w = await render()
    expect(w.get('h1').text()).toBe('Баланс и оплата')
    expect(w.text()).toContain('32 события на балансе')
    expect(w.get('[data-testid="billing-balance"]').text()).toBe('32')
    const pkg = w.get('[data-testid="package-events_30"]').text()
    expect(pkg).toContain('30')
    expect(pkg).toContain('120,00 BYN')
    expect(pkg).toContain('4,00 BYN / событие')
    expect(pkg).toContain('Популярный')
    const big = w.get('[data-testid="package-events_100"]').text()
    expect(big).toContain('Скидка')
    expect(big).not.toMatch(/−\d+%/)
    const rows = w.findAll('[data-testid="balance-entry"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Событие «Основа · 28 мая»')
    expect(rows[0]!.text()).toContain('−1')
    expect(rows[1]!.text()).toContain('+1')
  })

  it('shows platform decisions on requests: approved and rejected with the reason (22.2.3)', async () => {
    balanceBody = summary({
      recentDecisions: [
        {
          id: 9,
          units: 50,
          amount: 4500,
          currency: 'BYN',
          createdAt: '2026-11-18T09:00:00.000Z',
          status: 'rejected',
          decidedAt: '2026-11-19T09:00:00.000Z',
          decisionComment: 'Оплата не поступила',
        },
        {
          id: 8,
          units: 30,
          amount: 3000,
          currency: 'BYN',
          createdAt: '2026-11-17T09:00:00.000Z',
          status: 'approved',
          decidedAt: '2026-11-18T09:00:00.000Z',
          decisionComment: 'внутренний комментарий',
        },
      ],
    })
    const w = await render()
    const items = w.findAll('[data-testid="billing-decisions"] li')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('+50 событий')
    expect(items[0]!.text()).toContain('Отклонена')
    expect(items[0]!.text()).toContain('Причина: Оплата не поступила')
    expect(items[1]!.text()).toContain('Подтверждена')
    expect(items[1]!.text()).not.toContain('внутренний комментарий')
  })

  it('hides the decisions block when there are none', async () => {
    const w = await render()
    expect(w.find('[data-testid="billing-decisions"]').exists()).toBe(false)
  })

  it('never shows the word credits to the organizer', async () => {
    const w = await render()
    expect(w.text().toLowerCase()).not.toContain('credit')
  })

  it('shows unlimited with the kept balance, hides low-balance warnings, keeps buying (22.3.1)', async () => {
    balanceBody = summary({
      balance: 2,
      low: true,
      unlimited: { until: '2999-12-31' },
      supportContact: '@volleytime_support',
    })
    const w = await render()
    const block = w.get('[data-testid="billing-unlimited"]').text()
    expect(block).toContain('Безлимит событий до 31.12.2999')
    expect(block).toContain('на балансе 2 события — сохранится после')
    expect(w.find('[data-testid="billing-unlimited-ending"]').exists()).toBe(false) // далеко от конца
    expect(w.text()).not.toContain('Баланс заканчивается')
    expect(w.text()).not.toContain('Баланс исчерпан')
    expect(w.get('[data-testid="billing-support"]').text()).toBe(
      'Вопросы по оплате — @volleytime_support',
    )
    expect(w.find('[data-testid="package-events_10"] button').exists()).toBe(true) // покупка доступна
  })

  it('warns that unlimited is ending within three days', async () => {
    balanceBody = summary({ unlimited: { until: minskToday() } })
    const w = await render()
    expect(w.get('[data-testid="billing-unlimited-ending"]').text()).toMatch(
      /^Безлимит заканчивается \d{2}\.\d{2}\.\d{4}$/,
    )
  })

  it('shows neither the unlimited block nor the support line when they are absent', async () => {
    const w = await render()
    expect(w.find('[data-testid="billing-unlimited"]').exists()).toBe(false)
    expect(w.find('[data-testid="billing-support"]').exists()).toBe(false)
  })

  it('warns when the balance is running out and stays quiet otherwise', async () => {
    let w = await render()
    expect(w.find('.vt-desktop-billing__warning').exists()).toBe(false)
    w.unmount()
    balanceBody = summary({ balance: 8, low: true })
    w = await render()
    expect(w.get('.vt-desktop-billing__warning').text()).toContain(
      'Баланс заканчивается: осталось 8 событий.',
    )
  })

  it('asks for confirmation, then creates a purchase request for the chosen package only', async () => {
    const w = await render()
    await w.get('[data-testid="package-events_30"] button').trigger('click')
    expect(apiFetch).not.toHaveBeenCalledWith(
      '/api/organizations/30/event-balance/purchase-requests',
      expect.anything(),
    )
    expect(w.get('[role="group"]').text()).toContain('Купить «30 событий»?')
    expect(w.get('[role="group"]').text()).toContain('120,00 BYN')

    balanceBody = summary({
      pendingRequests: [
        { id: 1, units: 30, amount: 12000, currency: 'BYN', createdAt: '2026-06-01T09:00:00.000Z' },
      ],
    })
    await byText(w, 'Подтвердить покупку')!.trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/event-balance/purchase-requests', {
      method: 'POST',
      body: { packageCode: 'events_30' },
    })
    expect(w.get('.vt-desktop-billing__notice').text()).toContain(
      '+30 событий будут зачислены после подтверждения',
    )
    expect(w.find('[role="group"]').exists()).toBe(false)
    expect(w.get('.vt-desktop-billing__pending').text()).toContain('+30 событий')
    // баланс не меняется до подтверждения заявки
    expect(w.get('[data-testid="billing-balance"]').text()).toBe('32')
  })

  it('cancelling the confirmation sends nothing', async () => {
    const w = await render()
    await w.get('[data-testid="package-events_10"] button').trigger('click')
    await byText(w, 'Отмена')!.trigger('click')
    expect(w.find('[role="group"]').exists()).toBe(false)
    expect(
      apiFetch.mock.calls.some(
        ([, o]) => (o as { method?: string } | undefined)?.method === 'POST',
      ),
    ).toBe(false)
  })

  it('shows the server error and keeps the choice when the request is rejected', async () => {
    const w = await render()
    apiFetch.mockImplementationOnce(async () => {
      throw new Error('Только владелец группы может покупать')
    })
    await w.get('[data-testid="package-events_10"] button').trigger('click')
    // первая запрос после клика — POST
    await byText(w, 'Подтвердить покупку')!.trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toBe('Только владелец группы может покупать')
    expect(w.find('[role="group"]').exists()).toBe(true)
    expect(byText(w, 'Подтвердить покупку')!.attributes('disabled')).toBeUndefined()
  })

  it('an organizer sees the balance and history but cannot buy', async () => {
    role = 'organizer'
    const w = await render()
    expect(w.get('[data-testid="billing-balance"]').text()).toBe('32')
    expect(w.findAll('[data-testid="package-events_10"] button')).toHaveLength(0)
    expect(w.get('[role="note"]').text()).toContain('владелец группы')
  })

  it('loads the next page of history by cursor', async () => {
    entriesBody = (cursor) =>
      cursor
        ? { entries: [entry(3, { reason: 'purchase', delta: 30, event: null })], nextCursor: null }
        : { entries: [entry(1)], nextCursor: 'c1' }
    const w = await render()
    expect(w.findAll('[data-testid="balance-entry"]')).toHaveLength(1)
    await byText(w, 'Показать ещё')!.trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/event-balance/entries', {
      query: { cursor: 'c1' },
    })
    const rows = w.findAll('[data-testid="balance-entry"]')
    expect(rows).toHaveLength(2)
    expect(rows[1]!.text()).toContain('Пакет 30 событий')
    expect(byText(w, 'Показать ещё')).toBeUndefined()
  })

  it('shows an empty history and an error state with retry', async () => {
    entriesBody = () => ({ entries: [], nextCursor: null })
    let w = await render()
    expect(w.text()).toContain('Операций пока нет.')
    w.unmount()
    apiFetch.mockReset().mockRejectedValue(new Error('boom'))
    w = await render()
    expect(w.text()).toContain('boom')
    expect(w.find('[data-testid="billing-balance"]').exists()).toBe(false)
  })
})
