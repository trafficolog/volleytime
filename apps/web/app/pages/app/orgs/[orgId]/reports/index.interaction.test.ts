// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense } from 'vue'

import ReportsPage from './index.vue'

import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import ReportsOverview from '~/components/desktop/ReportsOverview.vue'
import ReportsPeriodPicker from '~/components/desktop/ReportsPeriodPicker.vue'
import Avatar from '~/components/vt/Avatar.vue'
import Icon from '~/components/vt/Icon.vue'

const route = reactive<{ params: { orgId: string }; query: Record<string, string> }>({
  params: { orgId: '30' },
  query: {},
})
const replace = vi.fn()
const reportFetches: { url: string; query: unknown }[] = []
let wrapper: VueWrapper | undefined
let failReport = false

const report = {
  timezone: 'Europe/Minsk',
  currency: 'BYN',
  period: { from: '2026-05-01', to: '2026-05-31' },
  previous: { from: '2026-03-31', to: '2026-04-30' },
  money: {
    income: 1000,
    expense: 400,
    net: 600,
    granularity: 'week',
    buckets: [],
    expenseByCategory: [],
  },
  occupancy: {
    events: 2,
    seats: 5,
    capacity: 10,
    percent: 50,
    previous: { events: 0, seats: 0, capacity: 0, percent: null },
  },
  attendance: { visits: 0, noShows: 0, cancellations: 0, top: [] },
}

beforeEach(() => {
  route.query = {}
  failReport = false
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
        data: ref(failReport ? null : report),
        pending: ref(false),
        error: ref(failReport ? { statusCode: 500 } : null),
        refresh: vi.fn(),
      }
    }
    return { data: ref({ organization: { id: 30, defaultTimezone: 'Europe/Minsk' } }) }
  })
  vi.stubGlobal('computed', computed)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(ReportsPage) }) }),
    {
      attachTo: document.body,
      global: {
        components: {
          ErrorState,
          SkeletonList,
          VtIcon: Icon,
          VtAvatar: Avatar,
          DesktopReportsOverview: ReportsOverview,
          DesktopReportsPeriodPicker: ReportsPeriodPicker,
        },
        stubs: {
          NuxtLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('reports page (21.2.7, W-10)', () => {
  it('opens on the current month in the group zone and exports the same period', async () => {
    const page = await render()

    expect(reportFetches).toEqual([
      {
        url: '/api/organizations/30/reports',
        query: { from: '2026-05-01', to: '2026-05-31' },
      },
    ])
    expect(page.get('h1').text()).toBe('Отчёты')
    expect(page.findAll('.vt-desktop-reports__kpis > li')).toHaveLength(4)
    const exportLinks = page.findAll('a').map((a) => JSON.parse(a.attributes('data-to')!))
    expect(exportLinks).toEqual([
      {
        path: '/app/orgs/30/reports/export',
        query: { type: 'finance', from: '2026-05-01', to: '2026-05-31' },
      },
      {
        path: '/app/orgs/30/reports/export',
        query: { type: 'finance', from: '2026-05-01', to: '2026-05-31' },
      },
      {
        path: '/app/orgs/30/reports/export',
        query: { type: 'attendance', from: '2026-05-01', to: '2026-05-31' },
      },
    ])
  })

  it('takes a valid period from the address and ignores a broken one', async () => {
    route.query = { from: '2026-04-01', to: '2026-04-30' }
    await render()
    expect(reportFetches[0]!.query).toEqual({ from: '2026-04-01', to: '2026-04-30' })
    wrapper?.unmount()

    reportFetches.length = 0
    route.query = { from: '2026-04-30', to: '2026-04-01' }
    await render()
    expect(reportFetches[0]!.query).toEqual({ from: '2026-05-01', to: '2026-05-31' })
  })

  it('moves the period into the address when a preset is chosen', async () => {
    const page = await render()
    await page
      .findAll('.vt-desktop-reports__preset')
      .find((b) => b.text() === 'Q2 2026')!
      .trigger('click')

    expect(replace).toHaveBeenCalledWith({ query: { from: '2026-04-01', to: '2026-06-30' } })
  })

  it('shows an error state when the report cannot be loaded', async () => {
    failReport = true
    const page = await render()

    expect(page.get('[role="alert"]').text()).toContain('Не удалось загрузить отчёты')
    expect(page.find('.vt-desktop-reports__kpis').exists()).toBe(false)
  })
})
