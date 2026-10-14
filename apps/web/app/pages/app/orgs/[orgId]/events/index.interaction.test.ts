// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import DesktopEvents from './index.vue'

import DesktopEventCalendar from '~/components/desktop/EventCalendar.vue'
import DesktopEventTable from '~/components/desktop/EventTable.vue'
import Chip from '~/components/vt/Chip.vue'
import Icon from '~/components/vt/Icon.vue'
import SeatsMini from '~/components/vt/SeatsMini.vue'
import Segment from '~/components/vt/Segment.vue'
import Sheet from '~/components/vt/Sheet.vue'
import StateChip from '~/components/vt/StateChip.vue'

const route = reactive({ params: { orgId: '30' }, path: '/app/orgs/30/events' })
const ev = (id: number, title: string, startsAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  status: 'published',
  startsAt,
  endsAt: startsAt,
  capacity: 14,
  price: 0,
  currency: 'BYN',
  taken: 12,
  waitlist: 0,
  myBooking: null,
  venue: { name: 'Школа №24' },
  locationText: null,
  ...extra,
})
const events = [
  ev(1, 'Основа', '2026-05-25T17:00:00Z'),
  ev(2, 'Утренняя', '2026-05-28T08:00:00Z'),
  ev(3, 'Мини-турнир', '2026-05-28T12:00:00Z'),
  ev(4, 'Вечерняя', '2026-05-28T17:00:00Z', { status: 'cancelled' }),
]
const apiFetch = vi.fn(async (_url: string, _opts?: { query?: Record<string, unknown> }) => ({
  events,
}))

Object.entries({
  computed,
  ref,
  watch,
  onBeforeUnmount,
  useRoute: () => route,
  definePageMeta: () => undefined,
  useOrgTimezone: () => ({ tz: ref('Europe/Minsk') }),
  $fetch: apiFetch,
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}).forEach(([key, value]) => vi.stubGlobal(key, value))

function render() {
  return mount(DesktopEvents, {
    attachTo: document.body,
    global: {
      components: {
        DesktopEventCalendar,
        DesktopEventTable,
        VtChip: Chip,
        VtIcon: Icon,
        VtSeatsMini: SeatsMini,
        VtSegment: Segment,
        VtSheet: Sheet,
        VtStateChip: StateChip,
      },
      stubs: {
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        SkeletonList: true,
        ErrorState: true,
        EmptyState: true,
      },
    },
  })
}

const filterRadios = (wrapper: ReturnType<typeof render>) =>
  wrapper.get('[aria-label="Фильтр событий"]').findAll('[role="radio"]')
const viewRadios = (wrapper: ReturnType<typeof render>) =>
  wrapper.get('[aria-label="Вид событий"]').findAll('[role="radio"]')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-05-20T09:00:00Z'))
  apiFetch.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('cabinet events list (W-03)', () => {
  it('renders the reference table columns with status and seats axes', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('thead th').map((h) => h.text())).toEqual([
      'Дата',
      'Тренировка',
      'Зал',
      'Состав',
      'Статус',
    ])
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.find('a').attributes('href')).toBe('/app/orgs/30/events/1')
    expect(rows[0]!.text()).toContain('Школа №24')
    expect(rows[0]!.find('[role="meter"]').attributes('aria-label')).toBe('Занято 12 из 14')
    expect(rows[3]!.find('[data-event-state="cancelled"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('maps filter chips to the API and exposes them as a radiogroup', async () => {
    const wrapper = render()
    await flushPromises()
    expect(apiFetch.mock.calls[0]![1]!.query).toMatchObject({ filter: 'all' })
    expect(filterRadios(wrapper).map((r) => r.text())).toEqual([
      'Все',
      'Открыта запись',
      'Прошедшие',
      'Отменённые',
    ])
    await filterRadios(wrapper)[3]!.trigger('click')
    await flushPromises()
    expect(apiFetch.mock.calls.at(-1)![1]!.query).toMatchObject({
      filter: 'all',
      status: 'cancelled',
    })
    wrapper.unmount()
  })

  it('keeps the filter when switching list and calendar without refetching', async () => {
    const wrapper = render()
    await flushPromises()
    await filterRadios(wrapper)[2]!.trigger('click')
    await flushPromises()
    const calls = apiFetch.mock.calls.length
    const checked = () => wrapper.get('[aria-label="Фильтр событий"] [aria-checked="true"]').text()

    await viewRadios(wrapper)[1]!.trigger('click')
    expect(wrapper.find('table[aria-label="Календарь событий"]').exists()).toBe(true)
    expect(checked()).toBe('Прошедшие')

    await viewRadios(wrapper)[0]!.trigger('click')
    expect(wrapper.find('tbody tr').exists()).toBe(true)
    expect(checked()).toBe('Прошедшие')
    expect(apiFetch.mock.calls).toHaveLength(calls)
    wrapper.unmount()
  })
})

describe('cabinet events calendar (W-03)', () => {
  async function openCalendar() {
    const wrapper = render()
    await flushPromises()
    await viewRadios(wrapper)[1]!.trigger('click')
    return wrapper
  }

  it('shows the current month, at most two pills per day and a "+N ещё" button', async () => {
    const wrapper = await openCalendar()
    expect(wrapper.get('h2').text().toLowerCase()).toContain('май 2026')
    const day = wrapper.get('td[data-day="2026-05-28"]')
    expect(day.findAll('a')).toHaveLength(2)
    expect(day.get('button').text()).toBe('+1 ещё')
    expect(wrapper.get('td[data-day="2026-05-25"]').findAll('a')).toHaveLength(1)
    wrapper.unmount()
  })

  it('opens a picker with every event of the day and closes it with Escape', async () => {
    const wrapper = await openCalendar()
    await wrapper.get('td[data-day="2026-05-28"] button').trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog).toBeTruthy()
    expect(dialog.textContent).toContain('28 мая')
    expect([...dialog.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/app/orgs/30/events/2',
      '/app/orgs/30/events/3',
      '/app/orgs/30/events/4',
    ])
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it('navigates between months and back to today', async () => {
    const wrapper = await openCalendar()
    await wrapper.get('button[aria-label="Следующий месяц"]').trigger('click')
    expect(wrapper.get('h2').text().toLowerCase()).toContain('июнь 2026')
    await wrapper.get('button[aria-label="Предыдущий месяц"]').trigger('click')
    await wrapper.get('button[aria-label="Предыдущий месяц"]').trigger('click')
    expect(wrapper.get('h2').text().toLowerCase()).toContain('апрель 2026')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Сегодня')!
      .trigger('click')
    expect(wrapper.get('h2').text().toLowerCase()).toContain('май 2026')
    wrapper.unmount()
  })
})
