// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import MyCalendarRow from '../../../../components/MyCalendarRow.vue'

import Calendar from './calendar.vue'

const trackFeatureEvent = vi.hoisted(() => vi.fn())
vi.mock('~/utils/feature-events', () => ({ trackFeatureEvent }))

const group = (id: number, name: string, timezone = 'Europe/Minsk') => ({
  id,
  name,
  timezone,
  logoUpdatedAt: null,
})
const GROUPS = [group(3, 'VolleyTime Минск'), group(5, 'МинскВолей'), group(9, 'СпайкКлуб')]
type Ev = {
  id: number
  organizationId: number
  title: string
  status: string
  startsAt: string
  endsAt: string
  capacity: number
  taken: number
  venue: { name: string } | null
  locationText: string | null
  myBooking: { id: number; status: string; waitPos: number | null; waitlistSeats: number } | null
}
const ev = (
  id: number,
  organizationId: number,
  title: string,
  startsAt: string,
  extra: Partial<Ev> = {},
): Ev => ({
  id,
  organizationId,
  title,
  status: 'published',
  startsAt,
  endsAt: new Date(Date.parse(startsAt) + 2 * 3600_000).toISOString(),
  capacity: 10,
  taken: 4,
  venue: null,
  locationText: null,
  myBooking: null,
  ...extra,
})
const going = { id: 1, status: 'confirmed', waitPos: null, waitlistSeats: 0 }
const queued = { id: 2, status: 'waitlisted', waitPos: 2, waitlistSeats: 0 }
const JUNE: Ev[] = [
  ev(1, 3, 'Основа', '2026-06-17T17:00:00Z', { myBooking: going, venue: { name: 'Школа №24' } }),
  // пересекается с «Основой» из другой группы
  ev(2, 5, 'Вечерняя', '2026-06-17T18:00:00Z', { myBooking: going }),
  ev(3, 9, 'Пляж 4×4', '2026-06-20T09:00:00Z', { myBooking: queued }),
  ev(4, 3, 'Открытая игра', '2026-06-24T16:30:00Z', { taken: 7 }),
  ev(5, 5, 'Полная игра', '2026-06-25T16:30:00Z', { taken: 10 }),
]

const route = reactive({ params: { orgId: '30' } })
const features = ref<{ features: { cal: boolean } } | null>({ features: { cal: true } })
const navigateTo = vi.fn()
let payload: { groups: unknown[]; events: Ev[] } = { groups: GROUPS, events: JUNE }
const apiFetch = vi.fn(async (..._args: unknown[]) => payload)
const mounted: VueWrapper[] = []

vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useFetch', () => ({ data: features }))
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('apiErrorMessage', () => 'Load failed')

async function renderCalendar() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Calendar) }) })
  const wrapper = mount(host, {
    attachTo: document.body,
    global: {
      components: { MyCalendarRow },
      stubs: {
        VtMiniHeader: { props: ['sub'], template: '<header><p class="sub">{{ sub }}</p></header>' },
        VtSegment: {
          props: ['modelValue', 'options', 'label'],
          emits: ['update:modelValue'],
          template:
            '<div :aria-label="label"><button v-for="o in options" :key="o.value" role="radio" :aria-checked="o.value === modelValue" @click="$emit(\'update:modelValue\', o.value)">{{ o.label }}</button></div>',
        },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        VtIcon: { template: '<span />' },
        VtMyChip: {
          props: ['booking'],
          template: '<span class="my-chip">{{ booking.status }}</span>',
        },
        SkeletonList: { template: '<p>Loading</p>' },
        ErrorState: {
          props: ['message'],
          template:
            '<div role="alert">{{ message }}<button @click="$emit(\'retry\')">Retry</button></div>',
        },
        EmptyState: {
          props: ['title', 'description'],
          template: '<p class="empty">{{ title }}|{{ description }}</p>',
        },
      },
    },
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

const radio = (w: VueWrapper, label: string) =>
  w.findAll('[role="radio"]').find((b) => b.text() === label)!
const rows = (w: VueWrapper) => w.findAll('.mycal-row')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T09:00:00Z'))
  route.params.orgId = '30'
  features.value = { features: { cal: true } }
  payload = { groups: GROUPS, events: JUNE }
  navigateTo.mockReset()
  trackFeatureEvent.mockReset()
  apiFetch.mockReset().mockImplementation(async () => payload)
})
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

describe('my calendar (23.2.2)', () => {
  it('reports one «cal» open for feature analytics (23.1.2)', async () => {
    await renderCalendar()
    expect(trackFeatureEvent).toHaveBeenCalledTimes(1)
    expect(trackFeatureEvent).toHaveBeenCalledWith('cal', 'open')
  })

  it('loads all groups of the player with ONE request for the month', async () => {
    await renderCalendar()
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch).toHaveBeenCalledWith('/api/me/calendar', {
      query: { from: '2026-06-01', to: '2026-06-30' },
    })
  })

  it('shows the title, month and subtitle with groups and going games', async () => {
    const wrapper = await renderCalendar()
    expect(wrapper.get('h2').text()).toBe('Июнь 2026')
    expect(wrapper.get('.sub').text()).toBe('3 группы · 2 записи в июне')
  })

  it('lists only my games by default, grouped by day, each with group name and dot', async () => {
    const wrapper = await renderCalendar()
    expect(rows(wrapper)).toHaveLength(3)
    const first = rows(wrapper)[0]!
    expect(first.text()).toContain('Основа')
    expect(first.text()).toContain('VolleyTime Минск')
    expect(first.text()).toContain('Школа №24')
    expect(first.text()).toContain('20:00')
    expect(first.text()).toContain('22:00')
    expect(first.attributes('href')).toBe('/m/orgs/3/events/1')
    expect(first.find('.mycal-dot').attributes('style')).toContain('--vt-group-1')
    expect(rows(wrapper)[1]!.find('.mycal-dot').attributes('style')).toContain('--vt-group-2')
    expect(wrapper.text()).toContain('Ср, 17 июня')
  })

  it('opens a game in ITS OWN group, not in the group of the page URL', async () => {
    const wrapper = await renderCalendar()
    const hrefs = rows(wrapper).map((r) => r.attributes('href'))
    expect(hrefs).toEqual(['/m/orgs/3/events/1', '/m/orgs/5/events/2', '/m/orgs/9/events/3'])
  })

  it('marks two overlapping games amber and shows the overlap banner', async () => {
    const wrapper = await renderCalendar()
    const chips = wrapper.findAll('[data-state="overlap"]')
    expect(chips).toHaveLength(2)
    expect(chips[0]!.classes()).toContain('vt-chip--amber')
    expect(chips[0]!.text()).toBe('пересечение')
    expect(wrapper.get('.mycal-clash').text()).toContain('Ср, 17 июня')
    expect(wrapper.get('.mycal-clash').text()).toContain('две записи пересекаются')
    // игра без пересечения показывает участие, а не «пересечение»
    expect(rows(wrapper)[2]!.find('.my-chip').text()).toBe('waitlisted')
  })

  it('the overlap banner jumps to the month view on the overlapping day', async () => {
    const wrapper = await renderCalendar()
    await wrapper.get('.mycal-clash').trigger('click')
    expect(radio(wrapper, 'Месяц').attributes('aria-checked')).toBe('true')
    expect(wrapper.find('.mycal-day--sel').attributes('aria-label')).toContain('игр: 2')
    expect(rows(wrapper)).toHaveLength(2)
    expect(wrapper.find('.mycal-clash-dot').exists()).toBe(true)
  })

  it('«С местами» adds games with free seats and never full ones', async () => {
    const wrapper = await renderCalendar()
    await radio(wrapper, 'С местами').trigger('click')
    expect(rows(wrapper).map((r) => r.attributes('href'))).toContain('/m/orgs/3/events/4')
    expect(rows(wrapper).map((r) => r.attributes('href'))).not.toContain('/m/orgs/5/events/5')
    const open = rows(wrapper).find((r) => r.attributes('href') === '/m/orgs/3/events/4')!
    expect(open.get('[data-state="seats"]').text()).toBe('3 места')
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('filters by group chip, still with one request', async () => {
    const wrapper = await renderCalendar()
    const chip = wrapper.findAll('.mycal-group').find((b) => b.text() === 'МинскВолей')!
    await chip.trigger('click')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.attributes('href')).toBe('/m/orgs/5/events/2')
    await wrapper.findAll('.mycal-group')[0]!.trigger('click')
    expect(rows(wrapper)).toHaveLength(3)
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('month view shows a dot per game: filled when going, ring in the queue', async () => {
    const wrapper = await renderCalendar()
    await radio(wrapper, 'Месяц').trigger('click')
    const day = (n: number) =>
      wrapper.findAll('.mycal-day').find((b) => b.find('.mycal-day__n').text() === String(n))!
    expect(day(17).findAll('.mycal-dots .mycal-dot')).toHaveLength(2)
    expect(day(17).find('.mycal-dot--ring').exists()).toBe(false)
    expect(day(20).find('.mycal-dot--ring').exists()).toBe(true)
    expect(day(18).find('.mycal-dots').exists()).toBe(false)
    expect(day(15).find('.mycal-day__n--today').exists()).toBe(true)
    // по умолчанию открыт ближайший день с играми после сегодня
    expect(day(17).classes()).toContain('mycal-day--sel')
    await day(20).trigger('click')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.text()).toContain('Пляж 4×4')
  })

  it('shows a cancelled game I had a booking on dimmed with «Отменена», and a muted dot in the month (23.2.4)', async () => {
    payload = {
      groups: GROUPS,
      events: [
        ...JUNE,
        ev(6, 3, 'Отменённая игра', '2026-06-22T17:00:00Z', {
          status: 'cancelled',
          myBooking: { id: 9, status: 'cancelled', waitPos: null, waitlistSeats: 0 },
        }),
      ],
    }
    const wrapper = await renderCalendar()
    const row = rows(wrapper).find((r) => r.attributes('href') === '/m/orgs/3/events/6')!
    expect(row.classes()).toContain('mycal-row--dim')
    expect(row.get('[data-state="cancelled"]').text()).toBe('Отменена')
    expect(row.find('[data-state="seats"]').exists()).toBe(false)
    // «С местами» не меняет вид и не добавляет лишнего
    await radio(wrapper, 'С местами').trigger('click')
    expect(rows(wrapper).filter((r) => r.find('[data-state="cancelled"]').exists())).toHaveLength(1)
    await radio(wrapper, 'Месяц').trigger('click')
    const day22 = wrapper
      .findAll('.mycal-day')
      .find((b) => b.find('.mycal-day__n').text() === '22')!
    expect(day22.find('.mycal-dot--muted').exists()).toBe(true)
    expect(day22.find('.mycal-dot--ring').exists()).toBe(false)
    expect(wrapper.find('.mycal-clash').exists()).toBe(true) // баннер от 17 июня, отменённая его не вызывает
  })

  it('switches the month with one new request per month', async () => {
    const wrapper = await renderCalendar()
    await wrapper.get('[aria-label="Следующий месяц"]').trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenLastCalledWith('/api/me/calendar', {
      query: { from: '2026-07-01', to: '2026-07-31' },
    })
    expect(wrapper.get('h2').text()).toBe('Июль 2026')
  })

  it('shows «Нет записей в этом месяце» with a hint when I have no games', async () => {
    payload = { groups: GROUPS, events: [] }
    const wrapper = await renderCalendar()
    expect(rows(wrapper)).toHaveLength(0)
    const empty = wrapper.get('.empty').text()
    expect(empty).toContain('Нет записей в этом месяце')
    expect(empty).toContain('С местами')
    expect(wrapper.find('.mycal-clash').exists()).toBe(false)
  })

  it('a player without groups sees the empty state and no group chips', async () => {
    payload = { groups: [], events: [] }
    const wrapper = await renderCalendar()
    expect(wrapper.find('.mycal-group').exists()).toBe(false)
    expect(wrapper.get('.empty').text()).toContain('Нет записей в этом месяце')
  })

  it('shows an error with retry', async () => {
    apiFetch.mockRejectedValueOnce(new Error('boom'))
    const wrapper = await renderCalendar()
    expect(wrapper.get('[role="alert"]').text()).toContain('Load failed')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(rows(wrapper)).toHaveLength(3)
  })

  it('with the «cal» flag off the page is not shown and the player goes to the group home', async () => {
    features.value = { features: { cal: false } }
    const wrapper = await renderCalendar()
    expect(navigateTo).toHaveBeenCalledWith('/m/orgs/30', { replace: true })
    expect(wrapper.find('.mycal-row').exists()).toBe(false)
    expect(trackFeatureEvent).not.toHaveBeenCalled()
  })

  it('treats a missing features answer as «cal» on', async () => {
    features.value = null
    const wrapper = await renderCalendar()
    expect(navigateTo).not.toHaveBeenCalled()
    expect(rows(wrapper)).toHaveLength(3)
  })
})
