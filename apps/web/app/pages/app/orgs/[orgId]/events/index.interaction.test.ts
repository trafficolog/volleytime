// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'

import DesktopEvents from './index.vue'

import DesktopEventCalendar from '~/components/desktop/EventCalendar.vue'
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
let listEvents: typeof events = events
let rangeEvents: typeof events | null = null
let holdRange: Promise<void> | null = null
let chatLink: { status: string; invalidReason?: string | null } | null = { status: 'active' }
let chatFails = false
const navigate = vi.fn()
const apiFetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
  if (url.endsWith('/telegram-chat')) {
    if (chatFails) throw new Error('boom')
    return { link: chatLink }
  }
  if (opts?.query?.from) {
    if (holdRange) await holdRange
    return { events: rangeEvents ?? events }
  }
  return { events: listEvents }
})

Object.entries({
  computed,
  ref,
  watch,
  onBeforeUnmount,
  nextTick,
  useRoute: () => route,
  definePageMeta: () => undefined,
  useOrgTimezone: () => ({ tz: ref('Europe/Minsk') }),
  useToast,
  navigateTo: navigate,
  $fetch: apiFetch,
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}).forEach(([key, value]) => vi.stubGlobal(key, value))

function render() {
  return mount(DesktopEvents, {
    attachTo: document.body,
    global: {
      components: {
        DesktopEventCalendar,
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
  navigate.mockClear()
  chatLink = { status: 'active' }
  chatFails = false
  useToast().dismiss()
  listEvents = events
  rangeEvents = null
  holdRange = null
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
      'Оплаты',
      'Статус',
      'Действия',
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
    const calls = apiFetch.mock.calls.filter(([, o]) => !o?.query?.from).length
    const checked = () => wrapper.get('[aria-label="Фильтр событий"] [aria-checked="true"]').text()

    await viewRadios(wrapper)[1]!.trigger('click')
    expect(wrapper.find('table[aria-label="Календарь событий"]').exists()).toBe(true)
    expect(checked()).toBe('Прошедшие')

    await viewRadios(wrapper)[0]!.trigger('click')
    expect(wrapper.find('tbody tr').exists()).toBe(true)
    expect(checked()).toBe('Прошедшие')
    expect(apiFetch.mock.calls.filter(([, o]) => !o?.query?.from)).toHaveLength(calls)
    wrapper.unmount()
  })
})

describe('cabinet events calendar (W-03)', () => {
  async function openCalendar() {
    const wrapper = render()
    await flushPromises()
    await viewRadios(wrapper)[1]!.trigger('click')
    await flushPromises()
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

  it('fetches the shown month by from/to with the active filter', async () => {
    const wrapper = await openCalendar()
    const query = apiFetch.mock.calls.at(-1)![1]!.query!
    expect(query).toMatchObject({ filter: 'all', from: '2026-04-27', to: '2026-05-31' })
    expect(query).not.toHaveProperty('offset')
    await wrapper.get('button[aria-label="Следующий месяц"]').trigger('click')
    await flushPromises()
    expect(apiFetch.mock.calls.at(-1)![1]!.query).toMatchObject({
      from: '2026-06-01',
      to: '2026-07-05',
    })
    wrapper.unmount()
  })

  it('shows the current month events even when the list page holds only older ones', async () => {
    const old = Array.from({ length: 50 }, (_, i) =>
      ev(100 + i, `Старое ${i}`, '2025-01-10T10:00:00Z'),
    )
    listEvents = old
    const wrapper = await openCalendar()
    expect(wrapper.findAll('td[data-day="2026-05-28"] a')).toHaveLength(2)
    wrapper.unmount()
  })

  it('keeps the month across filter changes and view toggles', async () => {
    const wrapper = await openCalendar()
    await wrapper.get('button[aria-label="Следующий месяц"]').trigger('click')
    await filterRadios(wrapper)[2]!.trigger('click')
    await flushPromises()
    expect(wrapper.get('h2').text().toLowerCase()).toContain('июнь 2026')
    expect(apiFetch.mock.calls.at(-1)![1]!.query).toMatchObject({
      filter: 'past',
      from: '2026-06-01',
    })
    await viewRadios(wrapper)[0]!.trigger('click')
    await viewRadios(wrapper)[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.get('h2').text().toLowerCase()).toContain('июнь 2026')
    wrapper.unmount()
  })

  it('does not blank the grid while the next month is loading', async () => {
    const wrapper = await openCalendar()
    let release!: () => void
    holdRange = new Promise<void>((resolve) => (release = resolve))
    rangeEvents = []
    await filterRadios(wrapper)[1]!.trigger('click')
    expect(wrapper.find('td[data-day="2026-05-28"] a').exists()).toBe(true)
    expect(wrapper.text()).toContain('Загружаем')
    release()
    await flushPromises()
    expect(wrapper.find('td[data-day="2026-05-28"] a').exists()).toBe(false)
    expect(wrapper.text()).toContain('В этом месяце событий нет')
    wrapper.unmount()
  })

  it('hides the duplicated day count from assistive technology', async () => {
    const wrapper = await openCalendar()
    expect(
      wrapper.get('td[data-day="2026-05-28"] .vt-desktop-calendar__count').attributes(),
    ).toMatchObject({
      'aria-hidden': 'true',
    })
    wrapper.unmount()
  })
})

describe('cabinet events list: payments column and row menu (20.5.8)', () => {
  const money = (extra: Record<string, unknown> = {}) =>
    ev(10, 'Делёж', '2026-05-30T17:00:00Z', {
      price: 0,
      priceMode: 'split',
      targetAmount: 10001,
      pricing: { mode: 'split' },
      paymentTotals: { paid: 3000, pending: 1500, currency: 'BYN' },
      splitShareQuote: {
        mode: 'split',
        basis: 'forecast',
        seats: 1,
        perSeat: { min: 3333, max: 3334 },
        total: { min: 3333, max: 3334 },
        seatCount: { current: 3, max: 14 },
        targetAmount: 10001,
        subscriptionApplicable: false,
        currency: 'BYN',
      },
      ...extra,
    })
  const menuButton = (row = 0) =>
    document
      .querySelectorAll<HTMLElement>('tbody tr')
      [row]!.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!
  const items = () => [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
  const item = (label: string) => items().find((i) => i.textContent!.includes(label))!
  const settle = async () => {
    await flushPromises()
    await flushPromises()
  }
  const mutations = () =>
    apiFetch.mock.calls.filter(([, o]) => (o as { method?: string } | undefined)?.method)

  it('shows paid, pending and the per-seat share in the «Оплаты» column', async () => {
    listEvents = [
      money(),
      ev(11, 'Бесплатная', '2026-05-31T17:00:00Z', {
        paymentTotals: { paid: 0, pending: 0, currency: 'BYN' },
      }),
    ]
    const wrapper = render()
    await flushPromises()
    const cells = wrapper.findAll('tbody tr').map((row) => row.findAll('td')[3]!.text())
    expect(cells[0]).toContain('30,00 BYN')
    expect(cells[0]).toContain('+15,00 BYN')
    expect(cells[0]).toContain('≈ 33,34 BYN за место')
    expect(cells[1]).toBe('—')
    wrapper.unmount()
  })

  it('opens a right-aligned menu with the danger action separated and returns focus on Escape', async () => {
    const wrapper = render()
    await flushPromises()
    const button = menuButton()
    expect(button.getAttribute('aria-haspopup')).toBe('menu')
    expect(button.getAttribute('aria-label')).toBe('Действия с событием «Основа»')
    button.click()
    await settle()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const menu = document.querySelector('[role="menu"]')!
    expect(menu.classList.contains('vt-popover--right')).toBe(true)
    expect(
      [...menu.children].map((c) => `${c.getAttribute('role')}:${c.textContent!.trim()}`),
    ).toEqual([
      'menuitem:Открыть событие',
      'menuitem:Дублировать',
      'menuitem:В чат группы',
      'separator:',
      'menuitem:Отменить событие',
    ])
    expect(document.activeElement).toBe(items()[0])
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(button)
    expect(navigate).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('«Открыть событие» navigates to the card', async () => {
    const wrapper = render()
    await flushPromises()
    menuButton(1).click()
    await settle()
    item('Открыть событие').click()
    await settle()
    expect(navigate).toHaveBeenCalledWith('/app/orgs/30/events/2')
    wrapper.unmount()
  })

  it('«Дублировать» posts a draft copy a week later, then reloads the list', async () => {
    listEvents = [
      ev(7, 'Основа', '2026-05-25T17:00:00Z', {
        type: 'training',
        venueId: 4,
        capacity: 14,
        price: 1500,
        priceMode: 'fixed',
        joinMode: 'open',
        endsAt: '2026-05-25T19:00:00Z',
      }),
    ]
    const wrapper = render()
    await flushPromises()
    menuButton().click()
    await settle()
    item('Дублировать').click()
    await settle()
    const [url, options] = mutations()[0]! as [
      string,
      { method: string; body: Record<string, unknown> },
    ]
    expect(url).toBe('/api/organizations/30/events')
    expect(options.method).toBe('POST')
    expect(options.body).toMatchObject({
      title: 'Основа',
      venueId: 4,
      capacity: 14,
      price: 1500,
      priceMode: 'fixed',
      joinMode: 'open',
      startsAt: '2026-06-01T17:00:00.000Z',
      endsAt: '2026-06-01T19:00:00.000Z',
      status: 'draft',
    })
    expect(useToast().current.value?.message).toContain('Черновик')
    expect(options.body.currency).toBe('BYN')
    // строка с меню исчезла после перезагрузки: фокус на заголовке, а не на body
    expect(document.activeElement).toBe(wrapper.get('h1').element)
    const lists = apiFetch.mock.calls.filter(
      ([u, o]) => u.endsWith('/events') && !(o as { method?: string } | undefined)?.method,
    )
    expect(lists).toHaveLength(2)
    wrapper.unmount()
  })

  it('«В чат группы» posts the announcement and reports success', async () => {
    const wrapper = render()
    await flushPromises()
    menuButton().click()
    await settle()
    const announce = item('В чат группы')
    expect(announce.getAttribute('aria-disabled')).toBeNull()
    announce.click()
    await settle()
    expect(mutations()[0]).toEqual([
      '/api/organizations/30/events/1/telegram-announce',
      { method: 'POST' },
    ])
    expect(useToast().current.value).toMatchObject({
      message: 'Анонс отправлен в чат группы',
      tone: 'ok',
    })
    wrapper.unmount()
  })

  it.each([
    ['no link', null, false, 'не привязан'],
    ['invalid link', { status: 'invalid', invalidReason: 'no_rights' }, false, 'нет права'],
    ['lookup failure', null, true, 'Не удалось проверить'],
  ])('«В чат группы» is disabled with a hint: %s', async (_name, link, fails, hint) => {
    chatLink = link
    chatFails = fails
    const wrapper = render()
    await flushPromises()
    menuButton().click()
    await settle()
    const announce = item('В чат группы')
    expect(announce.getAttribute('aria-disabled')).toBe('true')
    expect(announce.textContent).toContain(hint)
    announce.click()
    await settle()
    expect(mutations()).toHaveLength(0)
    wrapper.unmount()
  })

  it('reports a failed announcement as an error toast', async () => {
    const original = apiFetch.getMockImplementation()!
    apiFetch.mockImplementation(async (url: string, opts?: { query?: Record<string, unknown> }) => {
      if (url.endsWith('/telegram-announce')) throw new Error('rate')
      return original(url, opts)
    })
    const wrapper = render()
    await flushPromises()
    menuButton().click()
    await settle()
    item('В чат группы').click()
    await settle()
    expect(useToast().current.value).toMatchObject({ tone: 'danger' })
    apiFetch.mockImplementation(original)
    wrapper.unmount()
  })

  it('«Отменить событие» asks first: «Не отменять» sends nothing, confirming cancels and reloads', async () => {
    const wrapper = render()
    await flushPromises()
    menuButton().click()
    await settle()
    item('Отменить событие').click()
    await settle()
    const dialog = document.querySelector('[role="alertdialog"]')!
    expect(dialog.textContent).toContain('Отменить событие «Основа»?')
    expect(dialog.textContent).toContain('Баланс событий вернётся')
    ;[...dialog.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Не отменять'))!
      .click()
    await settle()
    expect(mutations()).toHaveLength(0)
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()

    menuButton().click()
    await settle()
    item('Отменить событие').click()
    await settle()
    ;[...document.querySelectorAll('[role="alertdialog"] button')]
      .find((b) => b.textContent!.trim() === 'Отменить событие')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle()
    expect(mutations()).toEqual([['/api/organizations/30/events/1/cancel', { method: 'POST' }]])
    expect(useToast().current.value?.message).toBe('Событие «Основа» отменено')
    wrapper.unmount()
  })

  it('re-reads the current time when the menu opens: a started event cannot be announced', async () => {
    const wrapper = render()
    await flushPromises()
    // событие 1 (25 мая 17:00Z) было будущим при отрисовке и началось, пока страница была открыта
    vi.setSystemTime(new Date('2026-05-25T18:00:00Z'))
    menuButton().click()
    await settle()
    expect(item('В чат группы').getAttribute('aria-disabled')).toBe('true')
    wrapper.unmount()
  })

  it('has no cancel item and no announcement for an already cancelled event', async () => {
    const wrapper = render()
    await flushPromises()
    menuButton(3).click()
    await settle()
    expect(items().map((i) => i.textContent!.trim())).not.toContain('Отменить событие')
    expect(item('В чат группы').getAttribute('aria-disabled')).toBe('true')
    wrapper.unmount()
  })
})
