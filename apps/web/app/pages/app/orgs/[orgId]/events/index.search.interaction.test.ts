// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'

import DesktopEvents from './index.vue'

import DesktopEventCalendar from '~/components/desktop/EventCalendar.vue'
import DesktopEventFilters from '~/components/desktop/EventFilters.vue'
import DesktopEventPager from '~/components/desktop/EventPager.vue'
import DesktopEventRowMenu from '~/components/desktop/EventRowMenu.vue'
import DesktopEventTable from '~/components/desktop/EventTable.vue'
import Alert from '~/components/vt/Alert.vue'
import Chip from '~/components/vt/Chip.vue'
import Icon from '~/components/vt/Icon.vue'
import Popover from '~/components/vt/Popover.vue'
import SeatsMini from '~/components/vt/SeatsMini.vue'
import Segment from '~/components/vt/Segment.vue'
import Sheet from '~/components/vt/Sheet.vue'
import StateChip from '~/components/vt/StateChip.vue'
import Toast from '~/components/vt/Toast.vue'
import { useToast } from '~/composables/useToast'

/** Task 21.2.10: поиск, панель «Фильтры», страницы «Показано N из M» и экспорт списка событий. */
const route = reactive({
  params: { orgId: '30' },
  path: '/app/orgs/30/events',
  query: {} as Record<string, string>,
})
const router = {
  replace: vi.fn(async ({ query }: { query: Record<string, string> }) => {
    route.query = query
  }),
}
const ev = (id: number, title: string) => ({
  id,
  title,
  status: 'published',
  startsAt: '2026-06-01T10:00:00Z',
  endsAt: '2026-06-01T12:00:00Z',
  capacity: 14,
  price: 0,
  currency: 'BYN',
  taken: 3,
  waitlist: 0,
  myBooking: null,
  venue: { name: 'Школа №24' },
  locationText: null,
})
let listEvents: ReturnType<typeof ev>[] = []
let listTotal = 0
const apiFetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
  if (url.endsWith('/telegram-chat')) return { link: null }
  if (url.endsWith('/venues')) return { venues: [{ id: 7, name: 'Школа №24' }] }
  if (opts?.query?.from && !opts.query.limit) return { events: listEvents }
  return { events: listEvents, total: listTotal }
})

Object.entries({
  computed,
  ref,
  watch,
  onBeforeUnmount,
  nextTick,
  useRoute: () => route,
  useRouter: () => router,
  definePageMeta: () => undefined,
  useOrgTimezone: () => ({ tz: ref('Europe/Minsk') }),
  useToast,
  navigateTo: vi.fn(),
  $fetch: apiFetch,
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}).forEach(([key, value]) => vi.stubGlobal(key, value))

const EmptyStub = {
  props: ['title'],
  template: '<div data-empty>{{ title }}<slot name="action" /></div>',
}

function render() {
  return mount(DesktopEvents, {
    attachTo: document.body,
    global: {
      components: {
        DesktopEventCalendar,
        DesktopEventFilters,
        DesktopEventPager,
        DesktopEventRowMenu,
        DesktopEventTable,
        VtAlert: Alert,
        VtPopover: Popover,
        VtToast: Toast,
        VtChip: Chip,
        VtIcon: Icon,
        VtSeatsMini: SeatsMini,
        VtSegment: Segment,
        VtSheet: Sheet,
        VtStateChip: StateChip,
        EmptyState: EmptyStub,
      },
      stubs: {
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        SkeletonList: true,
        ErrorState: true,
      },
    },
  })
}

const viewRadios = (wrapper: ReturnType<typeof render>) =>
  wrapper.get('[aria-label="Вид событий"]').findAll('[role="radio"]')
const lastListQuery = () =>
  apiFetch.mock.calls.filter(([u, o]) => u.endsWith('/events') && o?.query?.limit).at(-1)![1]!
    .query as Record<string, unknown>
const many = (n: number) => Array.from({ length: n }, (_, i) => ev(100 + i, `Игра ${i}`))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date('2026-05-20T09:00:00Z'))
  apiFetch.mockClear()
  router.replace.mockClear()
  route.query = {}
  listEvents = many(3)
  listTotal = 3
  useToast().dismiss()
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('cabinet events list: search, filters, pagination, export (21.2.10)', () => {
  it('requests a page with limit/offset and shows «Показано N из M»', async () => {
    listEvents = many(25)
    listTotal = 60
    const wrapper = render()
    await flushPromises()
    expect(lastListQuery()).toMatchObject({ limit: 25, offset: 0 })
    expect(wrapper.get('[role="status"]').text()).toBe('Показано 25 из 60')
    expect(wrapper.get('[aria-label="Предыдущая страница"]').attributes('disabled')).toBeDefined()
    const next = wrapper.get('[aria-label="Следующая страница"]')
    expect(next.attributes('disabled')).toBeUndefined()
    await next.trigger('click')
    await flushPromises()
    expect(route.query).toEqual({ page: '2' })
    expect(lastListQuery()).toMatchObject({ limit: 25, offset: 25 })
    expect(wrapper.text()).toContain('Страница 2 из 3')
    wrapper.unmount()
  })

  it('disables «next» on the last page', async () => {
    route.query = { page: '3' }
    listEvents = many(10)
    listTotal = 60
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('Показано 10 из 60')
    expect(wrapper.get('[aria-label="Следующая страница"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('searches after a pause, writes q to the URL and returns to the first page', async () => {
    route.query = { page: '2' }
    listTotal = 60
    const wrapper = render()
    await flushPromises()
    await wrapper.get('input[type="search"]').setValue('Основа')
    vi.advanceTimersByTime(299)
    expect(route.query).toEqual({ page: '2' })
    vi.advanceTimersByTime(2)
    await flushPromises()
    expect(route.query).toEqual({ q: 'Основа' })
    expect(lastListQuery()).toMatchObject({ q: 'Основа', offset: 0 })
    wrapper.unmount()
  })

  it('restores search, panel, venue, period, page and chip from the URL', async () => {
    route.query = {
      q: 'Основа',
      panel: '1',
      venue: '7',
      from: '2026-05-01',
      to: '2026-05-31',
      page: '2',
      tab: 'past',
    }
    listTotal = 60
    const wrapper = render()
    await flushPromises()
    expect(lastListQuery()).toMatchObject({
      filter: 'past',
      q: 'Основа',
      venueId: 7,
      from: '2026-05-01',
      to: '2026-05-31',
      offset: 25,
    })
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('Основа')
    expect(wrapper.find('[aria-label="Фильтры событий"]').exists()).toBe(true)
    expect((wrapper.get('[data-testid="filter-venue"]').element as HTMLSelectElement).value).toBe(
      '7',
    )
    expect(wrapper.get('[aria-label="Фильтр событий"] [aria-checked="true"]').text()).toBe(
      'Прошедшие',
    )
    wrapper.unmount()
  })

  it('opens the panel, applies venue and a valid period, rejects an invalid one', async () => {
    const wrapper = render()
    await flushPromises()
    const toggle = wrapper.findAll('button').find((b) => b.text() === 'Фильтры')!
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    await flushPromises()
    expect(route.query).toEqual({ panel: '1' })

    await wrapper.get('[data-testid="filter-venue"]').setValue('7')
    await flushPromises()
    expect(lastListQuery()).toMatchObject({ venueId: 7 })

    await wrapper.get('[data-testid="filter-from"]').setValue('2026-05-10')
    await wrapper.get('[data-testid="filter-from"]').trigger('change')
    expect(wrapper.get('[role="alert"]').text()).toMatch(/обе даты/)
    await wrapper.get('[data-testid="filter-to"]').setValue('2026-05-01')
    await wrapper.get('[data-testid="filter-to"]').trigger('change')
    expect(wrapper.get('[role="alert"]').text()).toMatch(/раньше/)
    expect(route.query.from).toBeUndefined()

    await wrapper.get('[data-testid="filter-to"]').setValue('2026-05-20')
    await wrapper.get('[data-testid="filter-to"]').trigger('change')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(route.query).toMatchObject({ from: '2026-05-10', to: '2026-05-20', venue: '7' })
    expect(lastListQuery()).toMatchObject({ from: '2026-05-10', to: '2026-05-20' })
    wrapper.unmount()
  })

  it('keeps search, venue and page across list/calendar toggles; the calendar uses the month range', async () => {
    route.query = { q: 'Основа', venue: '7', page: '2', panel: '1' }
    listTotal = 60
    const wrapper = render()
    await flushPromises()
    await viewRadios(wrapper)[1]!.trigger('click')
    await flushPromises()
    expect(route.query).toMatchObject({ view: 'calendar', q: 'Основа', venue: '7', page: '2' })
    const calendarCall = apiFetch.mock.calls
      .filter(([, o]) => o?.query?.from && !o.query.limit)
      .at(-1)![1]!.query as Record<string, unknown>
    expect(calendarCall).toMatchObject({ q: 'Основа', venueId: 7 })
    expect(wrapper.find('[data-testid="filter-from"]').exists()).toBe(false)
    await viewRadios(wrapper)[0]!.trigger('click')
    await flushPromises()
    expect(route.query).toMatchObject({ q: 'Основа', venue: '7', page: '2' })
    expect(route.query.view).toBeUndefined()
    wrapper.unmount()
  })

  it('shows an empty state with «Сбросить фильтры» that clears search, panel filters and the chip', async () => {
    route.query = { q: 'нет такого', tab: 'past', venue: '7' }
    listEvents = []
    listTotal = 0
    const wrapper = render()
    await flushPromises()
    const reset = wrapper.findAll('button').find((b) => b.text() === 'Сбросить фильтры')!
    expect(reset).toBeDefined()
    expect(wrapper.find('[aria-label="Предыдущая страница"]').exists()).toBe(false)
    await reset.trigger('click')
    await flushPromises()
    expect(route.query).toEqual({})
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('offers «Создать событие» instead of the reset when nothing is filtered', async () => {
    listEvents = []
    listTotal = 0
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('Событий пока нет')
    expect(wrapper.text()).not.toContain('Сбросить фильтры')
    wrapper.unmount()
  })

  it('moves back to the last page when the requested page is past the end', async () => {
    route.query = { page: '5' }
    listEvents = []
    listTotal = 30
    const wrapper = render()
    await flushPromises()
    expect(route.query).toEqual({ page: '2' })
    wrapper.unmount()
  })

  it('exports the filtered list through a download link without the page', async () => {
    route.query = { q: 'a&b', tab: 'open', venue: '7', page: '2' }
    listTotal = 60
    const wrapper = render()
    await flushPromises()
    const link = wrapper.get('[data-testid="events-export"]')
    expect(link.attributes('download')).toBeDefined()
    const url = new URL(link.attributes('href')!, 'http://x')
    expect(url.pathname).toBe('/api/organizations/30/events/export')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      filter: 'upcoming',
      status: 'published',
      q: 'a&b',
      venueId: '7',
    })
    wrapper.unmount()
  })
})
