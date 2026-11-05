// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, Suspense, watch } from 'vue'

import ExportPage from './export.vue'

import ReportsPeriodPicker from '~/components/desktop/ReportsPeriodPicker.vue'
import Icon from '~/components/vt/Icon.vue'

const route = reactive<{ params: { orgId: string }; query: Record<string, string> }>({
  params: { orgId: '30' },
  query: { type: 'finance', from: '2026-05-01', to: '2026-05-31' },
})
const apiFetch = vi.fn()
let wrapper: VueWrapper | undefined

const FINANCE_COLUMNS = [
  'date',
  'type',
  'category',
  'description',
  'event',
  'method',
  'amount',
  'currency',
  'payer',
]

function previewFor(query: { type: string; columns: string }) {
  const keys = query.columns.split(',')
  return {
    type: query.type,
    columns: keys.map((key) => ({ key, label: key.toUpperCase() })),
    rows: [keys.map((key) => `${key}-1`), keys.map((key) => `${key}-2`)],
    total: 64,
    bytes: 4915,
  }
}

beforeEach(() => {
  route.query = { type: 'finance', from: '2026-05-01', to: '2026-05-31' }
  apiFetch
    .mockReset()
    .mockImplementation(async (_url: string, opts: { query: never }) => previewFor(opts.query))
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({
    replace: async ({ query }: { query: Record<string, string> }) => {
      route.query = query
    },
  }))
  vi.stubGlobal('useFetch', async () => ({
    data: ref({ organization: { id: 30, defaultTimezone: 'Europe/Minsk' } }),
  }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
  vi.stubGlobal('$fetch', apiFetch)
  vi.stubGlobal(
    'apiErrorMessage',
    (e: { message?: string }, fallback: string) => e?.message ?? fallback,
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(ExportPage) }) }),
    {
      attachTo: document.body,
      global: {
        components: { VtIcon: Icon, DesktopReportsPeriodPicker: ReportsPeriodPicker },
        stubs: { NuxtLink: { props: ['to'], template: '<a><slot /></a>' } },
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('report export page (21.2.7, W-10)', () => {
  it('previews the default finance columns and offers the file with the same period and columns', async () => {
    const page = await render()

    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch.mock.calls[0]![0]).toBe('/api/organizations/30/reports/export')
    expect(apiFetch.mock.calls[0]![1].query).toEqual({
      type: 'finance',
      from: '2026-05-01',
      to: '2026-05-31',
      columns: FINANCE_COLUMNS.join(','),
      preview: '1',
    })
    expect(page.get('[data-testid="reports-total"]').text()).toBe('64')
    expect(page.findAll('thead th')).toHaveLength(9)
    expect(page.findAll('tbody tr')).toHaveLength(2)
    expect(page.text()).toContain('≈ 4,8 КБ')
    expect(page.text()).toContain('первые 2 из 64')
    expect(page.get('[data-testid="reports-download"]').attributes('href')).toBe(
      `/api/organizations/30/reports/export?type=finance&from=2026-05-01&to=2026-05-31&columns=${encodeURIComponent(FINANCE_COLUMNS.join(','))}`,
    )
  })

  it('adds an optional column in the layout order and refreshes the preview', async () => {
    const page = await render()
    const author = page.findAll('.vt-chip').find((c) => c.text() === 'Внёс')!
    expect(author.attributes('aria-pressed')).toBe('false')
    await author.trigger('click')
    await flushPromises()

    const query = apiFetch.mock.calls.at(-1)![1].query
    expect(query.columns).toBe([...FINANCE_COLUMNS, 'author'].join(','))
    expect(page.findAll('thead th')).toHaveLength(10)
    expect(page.text()).toContain('10 из 10')
  })

  it('disables the download and skips the request when no column is chosen', async () => {
    const page = await render()
    for (const chip of page.findAll('.vt-chip')) {
      if (chip.attributes('aria-pressed') === 'true') await chip.trigger('click')
    }
    await flushPromises()

    expect(page.text()).toContain('Выберите хотя бы одну колонку.')
    expect(page.find('[data-testid="reports-download"]').exists()).toBe(false)
    expect(page.get('header button[disabled]').text()).toContain('Скачать CSV')
    const callsAfterClear = apiFetch.mock.calls.length
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledTimes(callsAfterClear)
  })

  it('switches the report type with its own columns', async () => {
    const page = await render()
    await page.findAll('.vt-desktop-reports__types button')[1]!.trigger('click')
    await flushPromises()

    const query = apiFetch.mock.calls.at(-1)![1].query
    expect(query.type).toBe('attendance')
    expect(query.columns).toBe('player,visits,seats,noShows,cancellations,lastVisit')
    expect(page.get('[data-testid="reports-download"]').attributes('href')).toContain(
      'type=attendance',
    )
  })

  it('shows the server refusal for an oversized export and keeps the download off', async () => {
    apiFetch.mockRejectedValue({ message: 'В выгрузке больше 5000 строк: сузьте период' })
    const page = await render()

    expect(page.get('[role="alert"]').text()).toContain('В выгрузке больше 5000 строк')
    expect(page.find('[data-testid="reports-download"]').exists()).toBe(false)
  })

  it('shows an empty state when the period has nothing to export', async () => {
    apiFetch.mockResolvedValue({ type: 'finance', columns: [], rows: [], total: 0, bytes: 3 })
    const page = await render()

    expect(page.text()).toContain('За период нет данных для выгрузки.')
  })
})
