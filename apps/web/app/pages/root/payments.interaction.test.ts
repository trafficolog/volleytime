// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  Suspense,
  watch,
} from 'vue'

import Payments from './payments.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import { stubPlatformStaff } from '~/test-support/platform-staff'

const route = reactive<{ query: Record<string, string> }>({ query: {} })
const apiFetch = vi.fn()
const toastShow = vi.fn()
const refreshList = vi.fn()
const refreshSummary = vi.fn()
const queries: Record<string, unknown>[] = []
let wrapper: VueWrapper | undefined

const ROW = {
  id: 7,
  organization: { id: 3, name: 'VolleyTime Минск' },
  units: 50,
  amount: 4500,
  currency: 'BYN',
  status: 'pending',
  createdAt: '2026-11-19T09:02:00.000Z',
  decidedAt: null,
  decidedBy: null,
  decisionComment: null,
  requestedBy: { id: 2, name: 'Аня' },
}
const SUMMARY = {
  from: null,
  to: null,
  approved: [{ currency: 'BYN', amount: 61000, count: 3, units: 120 }],
  pendingCount: 1,
  rejectedCount: 0,
  payingOrganizations: 2,
  ledger: { approvedUnits: 120, ledgerUnits: 120, ledgerEntries: 3, matches: true },
  byOrganizationTruncated: false,
  byOrganization: [
    {
      organization: { id: 3, name: 'VolleyTime Минск' },
      currency: 'BYN',
      amount: 34000,
      units: 70,
      count: 2,
    },
  ],
}
let summaryBody: typeof SUMMARY

beforeEach(() => {
  route.query = {}
  summaryBody = SUMMARY
  queries.length = 0
  toastShow.mockReset()
  refreshList.mockReset().mockResolvedValue(undefined)
  refreshSummary.mockReset().mockResolvedValue(undefined)
  apiFetch.mockReset().mockResolvedValue({
    request: { ...ROW, status: 'approved', organization: ROW.organization },
    balanceAfter: 55,
  })
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useHead', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('createError', (e: unknown) => e)
  vi.stubGlobal(
    'useFetch',
    async (url: string, opts: { query: { value: Record<string, unknown> } }) => {
      const isSummary = url.endsWith('/summary')
      if (!isSummary) queries.push(opts.query.value)
      return {
        data: ref(isSummary ? summaryBody : { items: [ROW], nextCursor: null }),
        pending: ref(false),
        error: ref(null),
        refresh: isSummary ? refreshSummary : refreshList,
      }
    },
  )
  for (const [name, value] of Object.entries({
    computed,
    watch,
    ref,
    reactive,
    nextTick,
    onBeforeUnmount,
  })) {
    vi.stubGlobal(name, value)
  }
  stubPlatformStaff('owner')
  vi.stubGlobal('$fetch', apiFetch)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Payments) }) }),
    {
      attachTo: document.body,
      global: {
        components: { ErrorState, SkeletonList, EmptyState },
        stubs: { VtIcon: true, VtToast: true, NuxtLink: { template: '<a><slot /></a>' } },
      },
    },
  )
  await flushPromises()
  return wrapper
}

const byText = (w: VueWrapper, text: string) =>
  w.findAll('button').find((b) => b.text().trim() === text)

describe('Root Admin · Подписки и выплаты (R-04, D-07)', () => {
  it('shows period totals, the ledger check and pending requests by default', async () => {
    const w = await render()
    expect(w.get('h1').text()).toContain('Подписки и выплаты')
    expect(w.get('[data-testid="payments-total"]').text().replace(/\s/g, ' ')).toBe('610,00 BYN')
    expect(w.get('[data-testid="payments-pending"]').text()).toBe('1')
    expect(w.get('[data-testid="payments-ledger"]').text()).toBe('Сходится')
    expect(queries[0]).toMatchObject({ status: 'pending', limit: 20 })
    const row = w.get('[data-request-row]').text()
    expect(row).toContain('+50 событий')
    expect(row).toContain('Ждёт решения')
    expect(w.text().toLowerCase()).not.toContain('credit')
    expect(w.get('a[download]').attributes('href')).toMatch(
      /^\/api\/platform\/event-balance\/purchase-requests\/export\?from=.*&to=/,
    )
  })

  it('labels pending as all-time and shows no truncation note by default', async () => {
    const w = await render()
    expect(w.text()).toContain('Ждут решения (всего)')
    expect(w.find('[data-testid="orgs-truncated"]').exists()).toBe(false)
  })

  it('notes a truncated organization list', async () => {
    summaryBody = { ...SUMMARY, byOrganizationTruncated: true }
    const w = await render()
    await w.findAll('[role="tab"]')[1]!.trigger('click')
    expect(w.get('[data-testid="orgs-truncated"]').text()).toContain('первые 100')
  })

  it('flags a mismatch between approved requests and the ledger', async () => {
    summaryBody = { ...SUMMARY, ledger: { ...SUMMARY.ledger, ledgerUnits: 119, matches: false } }
    const w = await render()
    expect(w.get('[data-testid="payments-ledger"]').text()).toBe('Расхождение')
  })

  it('approves after confirmation, refreshes the registry and totals', async () => {
    const w = await render()
    await w.get('[aria-label="Подтвердить заявку №7"]').trigger('click')
    expect(w.get('#decision-title').text()).toContain('Подтвердить заявку №7')
    expect(apiFetch).not.toHaveBeenCalled()
    await w.get('textarea').setValue('Оплата по счёту')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/platform/event-balance/purchase-requests/7/approve',
      {
        method: 'POST',
        body: { comment: 'Оплата по счёту' },
      },
    )
    expect(refreshList).toHaveBeenCalled()
    expect(refreshSummary).toHaveBeenCalled()
    expect(toastShow.mock.calls[0]![0]).toContain('Заявка №7 подтверждена')
    expect(w.find('#decision-title').exists()).toBe(false)
  })

  it('reject requires a reason before sending', async () => {
    const w = await render()
    await w.get('[aria-label="Отклонить заявку №7"]').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).not.toHaveBeenCalled()
    expect(w.text()).toContain('Укажите причину отклонения')
    await w.get('textarea').setValue('Оплата не поступила')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/platform/event-balance/purchase-requests/7/reject',
      {
        method: 'POST',
        body: { reason: 'Оплата не поступила' },
      },
    )
  })

  it('an already decided request shows the conflict and reloads the list', async () => {
    apiFetch.mockRejectedValueOnce({
      statusCode: 409,
      data: { data: { code: 'purchase_request.not_pending' } },
    })
    const w = await render()
    await w.get('[aria-label="Подтвердить заявку №7"]').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('уже обработана')
    expect(refreshList).toHaveBeenCalled()
  })

  it('status filter switches the query; organizations tab filters the registry', async () => {
    const w = await render()
    await byText(w, 'Все')!.trigger('click')
    await w.findAll('[role="tab"]')[1]!.trigger('click')
    expect(w.get('[data-org-row]').text()).toContain('VolleyTime Минск')
    await w.get('[data-org-row] button').trigger('click')
    expect(w.get('[data-testid="org-filter"]').text()).toContain('VolleyTime Минск')
  })
})

describe('Root Admin · заявки на баланс: кнопки решения по роли (29.3.1, R-15)', () => {
  const decisionButtons = (w: VueWrapper) =>
    w.findAll('[aria-label^="Подтвердить заявку"], [aria-label^="Отклонить заявку"]')

  it.each(['owner', 'admin', 'finance'] as const)(
    '%s видит подтвердить и отклонить',
    async (role) => {
      stubPlatformStaff(role)
      const w = await render()
      expect(decisionButtons(w)).toHaveLength(2)
    },
  )

  it.each(['analyst', 'pending', 'error'] as const)(
    '%s видит заявку, но не кнопки решения',
    async (state) => {
      stubPlatformStaff(state)
      const w = await render()
      expect(w.find('[data-request-row]').exists()).toBe(true)
      expect(decisionButtons(w)).toHaveLength(0)
    },
  )
})
