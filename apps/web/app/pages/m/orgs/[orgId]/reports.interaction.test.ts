// @vitest-environment happy-dom
import type { ManagerReport } from '@volley-time/shared'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense } from 'vue'

import ReportsPage from './reports.vue'

import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import { reportKpis } from '~/utils/desktop-reports'

const route = reactive<{ params: { orgId: string }; query: Record<string, string> }>({
  params: { orgId: '30' },
  query: {},
})
const replace = vi.fn()
const reportFetches: { url: string; query: unknown }[] = []
let wrapper: VueWrapper | undefined
let reportError: unknown = null

const report: ManagerReport = {
  timezone: 'Europe/Minsk',
  currency: 'BYN',
  period: { from: '2026-05-01', to: '2026-05-31' },
  previous: { from: '2026-03-31', to: '2026-04-30' },
  money: {
    income: 31850,
    expense: 7000,
    net: 24850,
    granularity: 'week',
    buckets: [],
    expenseByCategory: [],
  },
  occupancy: {
    events: 12,
    seats: 87,
    capacity: 100,
    percent: 87,
    previous: { events: 10, seats: 82, capacity: 100, percent: 82 },
  },
  attendance: {
    visits: 40,
    noShows: 2,
    cancellations: 3,
    top: [
      {
        userId: 1,
        name: 'Анна Активная',
        telegramUsername: null,
        level: null,
        visits: 12,
        seats: 12,
        noShows: 0,
        cancellations: 0,
        lastVisitAt: null,
      },
    ],
  },
}

beforeEach(() => {
  route.query = {}
  reportError = null
  reportFetches.length = 0
  replace.mockReset()
  vi.setSystemTime(new Date('2026-05-20T10:00:00Z'))
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ replace }))
  vi.stubGlobal('useFetch', async (url: () => string, opts: { query?: { value: unknown } }) => {
    const target = url()
    if (target.endsWith('/reports')) {
      reportFetches.push({ url: target, query: opts.query?.value })
      return {
        data: ref(reportError ? null : report),
        pending: ref(false),
        error: ref(reportError),
        refresh: vi.fn(),
      }
    }
    return { data: ref({ organization: { defaultTimezone: 'Europe/Minsk' } }) }
  })
  vi.stubGlobal('computed', computed)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function renderPage() {
  const host = defineComponent({
    render: () => h(Suspense, null, { default: () => h(ReportsPage) }),
  })
  wrapper = mount(host, {
    global: {
      components: { ErrorState, SkeletonList },
      stubs: {
        VtMiniHeader: { template: '<header />' },
        VtIcon: { template: '<span />' },
        VtAvatar: { template: '<span />' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('Mini App month report (M-24, 21.1.3)', () => {
  it('requests the current group month from the cabinet reports API', async () => {
    const page = await renderPage()
    expect(reportFetches).toEqual([
      { url: '/api/organizations/30/reports', query: { from: '2026-05-01', to: '2026-05-31' } },
    ])
    expect(page.text()).toContain('Май 2026')
  })

  it('shows the same figures as the cabinet report tiles', async () => {
    const page = await renderPage()
    const [net, income, expense, occupancy] = reportKpis(report)
    expect(page.get('[data-report="net"]').text()).toBe(net!.value)
    expect(page.get('[data-report="income"]').text()).toBe(income!.value)
    expect(page.get('[data-report="expense"]').text()).toBe(expense!.value)
    expect(page.get('[data-report="occupancy"]').text()).toBe(occupancy!.value)
    expect(page.get('[data-report="events"]').text()).toBe('12')
    expect(page.get('[data-report="visits"]').text()).toBe('40')
    expect(page.text()).toContain('неявок 2 · отмен 3')
    expect(page.text()).toContain('Анна Активная')
    expect(page.text()).toContain('12 трен.')
  })

  it('steps back a month and cannot step past the current one', async () => {
    const page = await renderPage()
    expect(page.get('button[aria-label="Следующий месяц"]').attributes('disabled')).toBeDefined()
    await page.get('button[aria-label="Предыдущий месяц"]').trigger('click')
    expect(replace).toHaveBeenCalledWith({ query: { month: '2026-04' } })
  })

  it('opens the month from the address and ignores a future month', async () => {
    route.query = { month: '2026-03' }
    let page = await renderPage()
    expect(page.text()).toContain('Март 2026')
    expect(reportFetches[0]!.query).toEqual({ from: '2026-03-01', to: '2026-03-31' })
    expect(page.get('button[aria-label="Следующий месяц"]').attributes('disabled')).toBeUndefined()
    page.unmount()

    reportFetches.length = 0
    route.query = { month: '2027-01' }
    page = await renderPage()
    expect(reportFetches[0]!.query).toEqual({ from: '2026-05-01', to: '2026-05-31' })
  })

  it('tells a non-manager the report is for organizers', async () => {
    reportError = { statusCode: 403 }
    const page = await renderPage()
    expect(page.text()).toContain('Отчёт доступен организатору группы')
    expect(page.find('[data-report="net"]').exists()).toBe(false)
  })

  it('shows a retryable error for any other failure', async () => {
    reportError = { statusCode: 500 }
    const page = await renderPage()
    expect(page.text()).toContain('Не удалось загрузить отчёт')
  })
})
