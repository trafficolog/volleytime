// @vitest-environment happy-dom
import type { Event } from '@volley-time/db'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense } from 'vue'

import EventForm from './EventForm.vue'

import { apiErrorMessage } from '~/utils/api-error'

// W-11 (21.2.12): слот расписания подставляет поля формы создания события и серии.
const apiFetch = vi.fn()
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('apiErrorMessage', apiErrorMessage)
vi.stubGlobal('ref', ref)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('computed', computed)

// Среда 2030-06-05, 12:00 по Минску
const NOW = new Date('2030-06-05T09:00:00Z')

const slot = (over: Record<string, unknown> = {}) => ({
  id: 1,
  weekday: 5,
  startTime: '19:30',
  durationMinutes: 90,
  title: 'Открытая игра',
  type: 'open_game',
  capacity: 16,
  venueId: 8,
  venueName: 'Зал',
  venueArchived: false,
  ...over,
})

interface Mocks {
  slots: unknown[] | Error
}
let mocks: Mocks

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(NOW)
  apiFetch.mockReset()
  mocks = { slots: [slot(), slot({ id: 2, weekday: 1, startTime: '20:00', title: 'Основа' })] }
  apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (url.endsWith('/schedule-slots')) {
      if (mocks.slots instanceof Error) throw mocks.slots
      return { slots: mocks.slots }
    }
    if (url.endsWith('/settings')) {
      return {
        settings: { cancellationAllowed: true, cancellationDeadlineHours: 12, levels: [] },
      }
    }
    if (url.endsWith('/venues') && opts?.method !== 'POST') {
      return { venues: [{ id: 8, name: 'Зал', address: null }] }
    }
    if (url === '/api/levels') return { levels: [] }
    if (url.endsWith('/series/preview')) {
      return {
        timezone: 'Europe/Minsk',
        dates: [],
        excluded: [],
        total: 1,
        published: 1,
        drafts: 0,
        venueConflicts: 0,
        balanceEnforced: true,
        balanceBefore: 5,
        balanceAfter: 4,
      }
    }
    return { event: { id: 71, organizationId: 30 } }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

async function renderForm(initial?: Event) {
  const host = defineComponent({
    render: () =>
      h(Suspense, null, {
        default: () =>
          h(EventForm, {
            orgId: 30,
            tz: 'Europe/Minsk',
            initial,
            submitLabel: 'Создать событие',
            currency: 'BYN',
            allowSeries: true,
          }),
      }),
  })
  const wrapper = mount(host, { attachTo: document.body })
  await settle()
  return wrapper
}

async function settle() {
  await flushPromises()
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

const slotButton = (wrapper: VueWrapper) =>
  wrapper.findAll('button[aria-haspopup="listbox"]').find((b) => b.text().includes('Без шаблона'))
async function pickSlot(wrapper: VueWrapper, text: string) {
  await slotButton(wrapper)!.trigger('click')
  await settle()
  await wrapper
    .findAll('[role="option"]')
    .find((o) => o.text().includes(text))!
    .trigger('click')
  await settle()
}
const input = (wrapper: VueWrapper, selector: string) =>
  wrapper.get(selector).element as HTMLInputElement
const posts = (suffix: string) =>
  apiFetch.mock.calls.filter(([url, o]) => String(url).endsWith(suffix) && o?.method === 'POST')

describe('schedule slot in the event form', () => {
  it('offers the group slots and no picker when there are none or the list fails', async () => {
    const withSlots = await renderForm()
    expect(withSlots.text()).toContain('Слот расписания')
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/schedule-slots')
    withSlots.unmount()

    mocks.slots = []
    const empty = await renderForm()
    expect(empty.text()).not.toContain('Слот расписания')
    empty.unmount()

    mocks.slots = new Error('403')
    const failed = await renderForm()
    expect(failed.text()).not.toContain('Слот расписания')
    expect(failed.find('#ev-title').exists()).toBe(true)
    failed.unmount()
  })

  it('does not load or show slots when editing an event', async () => {
    const wrapper = await renderForm({
      id: 5,
      title: 'Игра',
      type: 'training',
      startsAt: new Date('2030-06-08T16:00:00Z'),
      endsAt: new Date('2030-06-08T18:00:00Z'),
      capacity: 10,
      price: 0,
      venueId: null,
      status: 'draft',
    } as unknown as Event)
    expect(wrapper.text()).not.toContain('Слот расписания')
    expect(apiFetch).not.toHaveBeenCalledWith('/api/organizations/30/schedule-slots')
    wrapper.unmount()
  })

  it('fills title, format, date, time, duration, places and venue from the slot', async () => {
    const wrapper = await renderForm()
    await pickSlot(wrapper, 'Открытая игра')
    expect(input(wrapper, '#ev-title').value).toBe('Открытая игра')
    // ближайшая пятница после среды 2030-06-05
    expect(input(wrapper, '#ev-start').value).toBe('2030-06-07T19:30')
    expect(input(wrapper, '#ev-cap').value).toBe('16')
    expect(wrapper.text()).toContain('1,5 часа')
    expect(wrapper.text()).toContain('Зал')
    expect(
      wrapper
        .findAll('button[role="radio"]')
        .find((b) => b.text() === 'Открытая игра')!
        .attributes('aria-checked'),
    ).toBe('true')
    wrapper.unmount()
  })

  it('the created event matches the slot and uses the usual event contract', async () => {
    const wrapper = await renderForm()
    await pickSlot(wrapper, 'Открытая игра')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(posts('/series')).toHaveLength(0) // «один раз» — обычное событие, не отдельный путь
    const body = posts('/events')[0]![1].body
    expect(body).toMatchObject({
      title: 'Открытая игра',
      type: 'open_game',
      capacity: 16,
      venueId: 8,
      startsAt: '2030-06-07T16:30:00.000Z',
      endsAt: '2030-06-07T18:00:00.000Z',
    })
    wrapper.unmount()
  })

  it('a weekly series from the slot repeats on the slot weekday and goes through POST series', async () => {
    const wrapper = await renderForm()
    await pickSlot(wrapper, 'Открытая игра')
    await wrapper
      .findAll('button[role="radio"]')
      .find((b) => b.text() === 'Каждую неделю')!
      .trigger('click')
    await settle()
    const preview = apiFetch.mock.calls
      .filter(([u]) => String(u).endsWith('/series/preview'))
      .at(-1)!
    expect(preview[1].body.rule).toMatchObject({
      freq: 'weekly',
      weekdays: [5],
      startDate: '2030-06-07',
    })
    expect(preview[1].body.template).toMatchObject({
      startTime: '19:30',
      durationMinutes: 90,
      capacity: 16,
      venueId: 8,
      type: 'open_game',
    })
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(posts('/series')).toHaveLength(1)
    expect(posts('/events')).toHaveLength(0)
    expect(posts('/series')[0]![1].body.template).toMatchObject({
      title: 'Открытая игра',
      startTime: '19:30',
      capacity: 16,
      venueId: 8,
    })
    wrapper.unmount()
  })

  it('takes today when the slot time has not passed yet and next week when it has', async () => {
    mocks.slots = [
      slot({ id: 3, weekday: 3, startTime: '20:00', title: 'Сегодня' }),
      slot({ id: 4, weekday: 3, startTime: '11:00', title: 'Уже прошло' }),
    ]
    const wrapper = await renderForm()
    await pickSlot(wrapper, 'Сегодня')
    expect(input(wrapper, '#ev-start').value).toBe('2030-06-05T20:00')
    wrapper.unmount()

    const again = await renderForm()
    await pickSlot(again, 'Уже прошло')
    expect(input(again, '#ev-start').value).toBe('2030-06-12T11:00')
    again.unmount()
  })

  it('does not substitute an archived venue: the venue stays empty with a hint and is not sent', async () => {
    mocks.slots = [slot({ venueId: 9, venueName: 'Старый зал', venueArchived: true })]
    const wrapper = await renderForm()
    await pickSlot(wrapper, 'Открытая игра')
    expect(wrapper.get('[data-testid="slot-venue-note"]').text()).toContain('Старый зал')
    expect(wrapper.text()).toContain('Не указана')
    await wrapper.get('form').trigger('submit')
    await settle()
    const body = posts('/events')[0]![1].body
    expect(body.venueId).toBeUndefined()
    expect(body).toMatchObject({ title: 'Открытая игра', capacity: 16 })
    wrapper.unmount()
  })

  it('a slot without a venue clears the previous choice and the note goes away', async () => {
    mocks.slots = [
      slot({ id: 5, venueId: 9, venueName: 'Старый зал', venueArchived: true }),
      slot({ id: 6, title: 'Без зала', venueId: null, venueName: null }),
    ]
    const wrapper = await renderForm()
    await pickSlot(wrapper, 'Старый зал')
    expect(wrapper.find('[data-testid="slot-venue-note"]').exists()).toBe(true)
    await slotButton(wrapper)
    await wrapper.findAll('button[aria-haspopup="listbox"]')[0]!.trigger('click')
    await settle()
    await wrapper
      .findAll('[role="option"]')
      .find((o) => o.text().includes('Без зала'))!
      .trigger('click')
    await settle()
    expect(wrapper.find('[data-testid="slot-venue-note"]').exists()).toBe(false)
    expect(input(wrapper, '#ev-title').value).toBe('Без зала')
    wrapper.unmount()
  })

  it('choosing a slot creates nothing by itself', async () => {
    const wrapper = await renderForm()
    await pickSlot(wrapper, 'Основа')
    expect(posts('/events')).toHaveLength(0)
    expect(posts('/series')).toHaveLength(0)
    wrapper.unmount()
  })
})
