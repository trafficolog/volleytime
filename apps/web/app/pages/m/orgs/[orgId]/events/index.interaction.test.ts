// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Events from './index.vue'

type Ev = {
  id: number
  title: string
  startsAt: string
  status: string
  myBooking: { id: number; status: string; waitPos?: number | null } | null
}
const ev = (id: number, title: string, startsAt: string, extra: Partial<Ev> = {}): Ev => ({
  id,
  title,
  startsAt,
  status: 'published',
  myBooking: null,
  ...extra,
})
const JUNE = [
  ev(1, 'Основа', '2026-06-03T17:00:00Z', { myBooking: { id: 1, status: 'confirmed' } }),
  ev(2, 'Открытая игра', '2026-06-05T16:30:00Z'),
  ev(3, 'Микст', '2026-06-05T07:00:00Z'),
  ev(4, 'Основа 2', '2026-06-17T17:00:00Z'),
]

const route = reactive({ params: { orgId: '30' } })
const orgData = ref({ organization: { id: 30 }, myMember: { role: 'owner', status: 'active' } })
const orgError = ref<Error | null>(null)
const navigateTo = vi.fn()
const apiFetch = vi.fn(async (..._args: unknown[]) => ({ events: JUNE }))
const mounted: VueWrapper[] = []

vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
vi.stubGlobal('useFetch', () => ({ data: orgData, error: orgError }))
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('apiErrorMessage', () => 'Load failed')
vi.stubGlobal('apiErrorCode', (e: { code?: string }) => e.code)

function deferred() {
  let resolve!: (value: { events: Ev[] }) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<{ events: Ev[] }>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

async function renderEvents() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Events) }) })
  const wrapper = mount(host, {
    attachTo: document.body,
    global: {
      mocks: { navigateTo },
      stubs: {
        VtMiniHeader: {
          props: ['sub'],
          template: '<header><p class="sub">{{ sub }}</p><slot name="right" /></header>',
        },
        VtSegment: {
          props: ['modelValue', 'options'],
          emits: ['update:modelValue'],
          template:
            '<div><button v-for="o in options" :key="o.value" role="radio" :aria-checked="o.value === modelValue" @click="$emit(\'update:modelValue\', o.value)">{{ o.label }}</button></div>',
        },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        VtIcon: { template: '<span />' },
        SkeletonList: { template: '<p>Loading events</p>' },
        ErrorState: {
          props: ['message'],
          template:
            '<div role="alert">{{ message }}<button @click="$emit(\'retry\')">Retry</button></div>',
        },
        EmptyState: { props: ['title'], template: '<p>{{ title }}<slot name="action" /></p>' },
        PlayerAccessNotice: { template: '<p>Access unavailable</p>' },
        OrganizerEventRow: {
          props: ['event', 'to'],
          template: '<a class="row" :href="to">{{ event.title }}</a>',
        },
        EventCard: {
          props: ['event', 'to'],
          template: '<a class="row" :href="to">{{ event.title }}</a>',
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
const dayButton = (w: VueWrapper, n: number) =>
  w.findAll('.schedule-day').find((b) => b.find('.schedule-day__n').text() === String(n))!
const asPlayer = () => {
  orgData.value.myMember.role = 'player'
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T09:00:00Z'))
  route.params.orgId = '30'
  orgData.value = { organization: { id: 30 }, myMember: { role: 'owner', status: 'active' } }
  orgError.value = null
  navigateTo.mockReset()
  apiFetch.mockReset().mockResolvedValue({ events: JUNE })
})
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

describe('group schedule month', () => {
  it('requests the current organization month and shows the title and role subtitle', async () => {
    asPlayer()
    const wrapper = await renderEvents()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/events', {
      query: { filter: 'all', from: '2026-06-01', to: '2026-06-30' },
    })
    expect(wrapper.get('h2').text()).toBe('Июнь 2026')
    expect(wrapper.get('.sub').text()).toBe('4 тренировки · вы записаны на 1')
  })

  it('shows several events of one day and links each to its event', async () => {
    asPlayer()
    const wrapper = await renderEvents()
    // по умолчанию выбран первый день с событиями — 3 июня (20:00 по Минску)
    expect(wrapper.findAll('.row').map((r) => r.text())).toEqual(['Основа'])
    await dayButton(wrapper, 5).trigger('click')
    expect(wrapper.findAll('.row').map((r) => r.text())).toEqual(['Микст', 'Открытая игра'])
    expect(wrapper.findAll('.row').map((r) => r.attributes('href'))).toEqual([
      '/m/orgs/30/events/3',
      '/m/orgs/30/events/2',
    ])
    expect(wrapper.text()).toContain('5 июня')
    expect(dayButton(wrapper, 5).findAll('.schedule-dot')).toHaveLength(2)
    expect(dayButton(wrapper, 3).find('.schedule-dot--going').exists()).toBe(true)
    expect((dayButton(wrapper, 4).element as HTMLButtonElement).disabled).toBe(true)
  })

  it('links organizer rows to the manage page and hides "Мои"', async () => {
    const wrapper = await renderEvents()
    expect(wrapper.get('.sub').text()).toBe('4 тренировки · вся группа')
    expect(wrapper.text()).not.toContain('Мои')
    expect(wrapper.get('.row').attributes('href')).toBe('/m/orgs/30/events/1/manage')
  })

  it('switches to the week list and filters by "Мои"', async () => {
    asPlayer()
    const wrapper = await renderEvents()
    await radio(wrapper, 'Список').trigger('click')
    expect(wrapper.findAll('section').map((s) => s.get('.vt-cap').text())).toEqual([
      '3–5 июня',
      '17 июня',
    ])
    expect(wrapper.findAll('.row')).toHaveLength(4)
    const mine = wrapper.findAll('button').find((b) => b.text() === 'Мои')!
    await mine.trigger('click')
    expect(mine.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.row').map((r) => r.text())).toEqual(['Основа'])
    apiFetch.mockResolvedValueOnce({ events: [] })
    await wrapper.get('[aria-label="Следующий месяц"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('В этом месяце у вас нет записей')
  })

  it('moves between months with the matching request range', async () => {
    const wrapper = await renderEvents()
    await wrapper.get('[aria-label="Предыдущий месяц"]').trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenLastCalledWith('/api/organizations/30/events', {
      query: { filter: 'all', from: '2026-05-01', to: '2026-05-31' },
    })
    expect(wrapper.get('h2').text()).toBe('Май 2026')
  })

  it('does not depend on the shared calendar: only the group events endpoint is used', async () => {
    asPlayer()
    await renderEvents()
    expect(apiFetch.mock.calls.every(([url]) => String(url).endsWith('/events'))).toBe(true)
  })
})

describe('month refresh', () => {
  it('keeps the header action mounted while disabling creation during loading', async () => {
    const wrapper = await renderEvents()
    const action = wrapper.get('.organizer-create-link').element as HTMLButtonElement
    expect(action.disabled).toBe(false)
    const pending = deferred()
    apiFetch.mockImplementationOnce(() => pending.promise)
    await wrapper.get('[aria-label="Следующий месяц"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('.organizer-create-link').element).toBe(action)
    expect(action.disabled).toBe(true)
    action.click()
    expect(navigateTo).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Loading events')
    pending.resolve({ events: [] })
    await flushPromises()
    expect(action.disabled).toBe(false)
    action.click()
    expect(navigateTo).toHaveBeenCalledWith('/m/orgs/30/events/new')
  })

  it('shows an error and keeps creation disabled until retry succeeds', async () => {
    const wrapper = await renderEvents()
    const action = wrapper.get('.organizer-create-link').element as HTMLButtonElement
    apiFetch.mockRejectedValueOnce(new Error('failure'))
    await wrapper.get('[aria-label="Следующий месяц"]').trigger('click')
    await flushPromises()
    expect(action.disabled).toBe(true)
    expect(wrapper.get('[role="alert"]').text()).toContain('Load failed')
    apiFetch.mockResolvedValueOnce({ events: [] })
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(action.disabled).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('ignores out-of-order rows and stale errors after rapid month switches', async () => {
    asPlayer()
    const wrapper = await renderEvents()
    const old = deferred()
    const latest = deferred()
    apiFetch.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => latest.promise)
    await wrapper.get('[aria-label="Следующий месяц"]').trigger('click')
    await wrapper.get('[aria-label="Предыдущий месяц"]').trigger('click')
    latest.resolve({ events: [ev(7, 'Latest june', '2026-06-10T17:00:00Z')] })
    await flushPromises()
    old.resolve({ events: [ev(8, 'Stale july', '2026-07-10T17:00:00Z')] })
    await flushPromises()
    await radio(wrapper, 'Список').trigger('click')
    expect(wrapper.text()).toContain('Latest june')
    expect(wrapper.text()).not.toContain('Stale july')
    const stale = deferred()
    apiFetch.mockImplementationOnce(() => stale.promise)
    await wrapper.get('[aria-label="Следующий месяц"]').trigger('click')
    await wrapper.get('[aria-label="Предыдущий месяц"]').trigger('click')
    await flushPromises()
    stale.reject(new Error('stale'))
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it.each(['player', 'inactive', 'foreign', 'error'])(
    'does not offer creation with %s access',
    async (access) => {
      if (access === 'player') orgData.value.myMember.role = 'player'
      if (access === 'inactive') orgData.value.myMember.status = 'inactive'
      if (access === 'foreign') orgData.value.organization.id = 31
      if (access === 'error') orgError.value = new Error('forbidden')
      const wrapper = await renderEvents()
      expect(wrapper.find('.organizer-create-link').exists()).toBe(false)
    },
  )
})
