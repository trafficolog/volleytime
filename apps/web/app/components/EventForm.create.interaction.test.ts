// @vitest-environment happy-dom
import { CreateEventInput, CreateSeriesInput, PreviewSeriesInput } from '@volley-time/core'
import type { Event } from '@volley-time/db'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense } from 'vue'

import EventForm from './EventForm.vue'

import { apiErrorMessage } from '~/utils/api-error'

// W-04 (20.5.5): создание события и серии в кабинете, join mode, уровень, баланс, ошибки.
const apiFetch = vi.fn()
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('apiErrorMessage', apiErrorMessage)
vi.stubGlobal('ref', ref)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('computed', computed)

// суббота
const START = '2030-06-08T19:00'

interface Mocks {
  settings: Record<string, unknown>
  preview: Record<string, unknown> | Error
  seriesPost: Record<string, unknown> | Error
  eventPost: Record<string, unknown> | Error
}
let mocks: Mocks

const settings = (over: Record<string, unknown> = {}) => ({
  cancellationAllowed: true,
  cancellationDeadlineHours: 12,
  maxSeatsPerBooking: 3,
  defaultPriceMode: 'fixed',
  defaultJoinMode: 'open',
  subscriptionsEnabled: false,
  levels: ['v2', 'v3'],
  ...over,
})

const previewOf = (over: Record<string, unknown> = {}) => ({
  timezone: 'Europe/Minsk',
  dates: [
    { date: '2030-06-08', startsAt: '', endsAt: '', status: 'published', draftReason: null },
    { date: '2030-06-15', startsAt: '', endsAt: '', status: 'published', draftReason: null },
  ],
  excluded: [],
  total: 2,
  published: 2,
  drafts: 0,
  venueConflicts: 0,
  balanceEnforced: true,
  balanceBefore: 32,
  balanceAfter: 30,
  ...over,
})

const apiError = (code: string, statusCode = 409) =>
  Object.assign(new Error(code), { statusCode, data: { statusMessage: 'x', data: { code } } })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  apiFetch.mockReset()
  mocks = {
    settings: settings(),
    preview: previewOf(),
    seriesPost: {
      series: { id: 5 },
      events: [],
      total: 2,
      published: 2,
      drafts: 0,
      venueConflicts: 0,
      balanceAfter: 30,
      replayed: false,
    },
    eventPost: { event: { id: 71, organizationId: 30 } },
  }
  apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (url.endsWith('/settings')) return { settings: mocks.settings }
    if (url.endsWith('/venues') && opts?.method !== 'POST') {
      return { venues: [{ id: 8, name: 'Зал', address: null }] }
    }
    if (url === '/api/levels') {
      return {
        levels: [
          { code: 'v1', title: 'В1', description: '' },
          { code: 'v2', title: 'В2', description: '' },
          { code: 'v3', title: 'В3', description: '' },
        ],
      }
    }
    const result = url.endsWith('/series/preview')
      ? mocks.preview
      : url.endsWith('/series')
        ? mocks.seriesPost
        : mocks.eventPost
    if (result instanceof Error) throw result
    return result
  })
})

afterEach(() => {
  vi.useRealTimers()
})

async function renderForm(props: Record<string, unknown> = {}, initial?: Event) {
  const emitted: Record<string, unknown[][]> = {}
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
            splitPricingEnabled: true,
            inviteModeEnabled: true,
            allowSeries: true,
            onSaved: (...a: unknown[]) => (emitted.saved ??= []).push(a),
            onSeriesCreated: (...a: unknown[]) => (emitted.seriesCreated ??= []).push(a),
            ...props,
          }),
      }),
  })
  const wrapper = mount(host, { attachTo: document.body })
  await settle()
  await wrapper.get('#ev-start').setValue(START)
  await settle()
  return { wrapper, emitted }
}

async function settle() {
  await flushPromises()
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

const radio = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button[role="radio"]').find((b) => b.text() === text)!

async function choose(wrapper: VueWrapper, text: string) {
  await radio(wrapper, text).trigger('click')
  await settle()
}

const calls = (suffix: string, method = 'POST') =>
  apiFetch.mock.calls.filter(
    ([url, opts]) => String(url).endsWith(suffix) && (opts?.method ?? 'GET') === method,
  )

const submitButton = (wrapper: VueWrapper) => wrapper.get('button[type="submit"]')

describe('create a single event', () => {
  it('takes defaults from the group settings and sends no join mode when it matches the group', async () => {
    mocks.settings = settings({ defaultPriceMode: 'split' })
    const { wrapper, emitted } = await renderForm()
    expect(radio(wrapper, 'Делим сумму').attributes('aria-checked')).toBe('true')
    expect(radio(wrapper, 'Свободная').attributes('aria-checked')).toBe('true')
    await wrapper.get('#ev-target').setValue('180')
    await wrapper.get('form').trigger('submit')
    await settle()
    const options = calls('/events')[0]![1]
    expect(options.body).toMatchObject({
      type: 'training',
      priceMode: 'split',
      targetAmount: 18000,
      capacity: 12,
    })
    expect(options.body).not.toHaveProperty('joinMode')
    expect(emitted.saved).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows the split forecast per seat at a full roster from the shared price quote', async () => {
    const { wrapper } = await renderForm()
    await radio(wrapper, 'Делим сумму').trigger('click')
    await wrapper.get('#ev-cap').setValue('14')
    await wrapper.get('#ev-target').setValue('180')
    await settle()
    const text = wrapper.get('#ev-split-hint').text()
    expect(text).toContain('Прогноз за место при полном составе')
    expect(text).toMatch(/12,85[\s\S]*12,86/)
    wrapper.unmount()
  })

  it('shows the fixed total at a full roster', async () => {
    const { wrapper } = await renderForm()
    await wrapper.get('#ev-price').setValue('15')
    await settle()
    expect(
      wrapper.get(`#${wrapper.get('#ev-price').attributes('aria-describedby')}`).text(),
    ).toMatch(/При полном составе соберётся\s+180,00/)
    wrapper.unmount()
  })

  it('shows seats per player as a group setting, not an event field', async () => {
    const { wrapper } = await renderForm()
    expect(wrapper.text()).toContain('Мест на игрока: до 3')
    expect(wrapper.find('input[name="maxSeatsPerBooking"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('marks a join mode that differs from the group and returns to the group value', async () => {
    mocks.settings = settings({ defaultJoinMode: 'invite' })
    const { wrapper } = await renderForm()
    expect(radio(wrapper, 'По приглашению').attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).not.toContain('только для этого события')
    await choose(wrapper, 'Свободная')
    expect(wrapper.text()).toContain('только для этого события')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(calls('/events')[0]![1].body).toMatchObject({ joinMode: 'open' })

    const reset = wrapper.findAll('button').find((b) => b.text() === 'Вернуть как в группе')!
    await reset.trigger('click')
    await settle()
    expect(radio(wrapper, 'По приглашению').attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).not.toContain('только для этого события')
    wrapper.unmount()
  })

  it('disables invite-only for a new event while the capability is off', async () => {
    const { wrapper } = await renderForm({ inviteModeEnabled: false })
    expect(radio(wrapper, 'По приглашению').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('offers the group levels and sends the chosen level', async () => {
    const { wrapper } = await renderForm()
    const level = wrapper.get('[aria-label="Уровень игроков"]')
    await level.trigger('click')
    const option = wrapper.findAll('[role="option"]').find((o) => o.text().includes('В3'))!
    expect(wrapper.findAll('[role="option"]').some((o) => o.text().includes('В1'))).toBe(false)
    await option.trigger('click')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(calls('/events')[0]![1].body).toMatchObject({ level: 'v3' })
    wrapper.unmount()
  })
})

describe('balance consequences of a single event', () => {
  it('shows what will be charged', async () => {
    mocks.preview = previewOf({ total: 1, published: 1, balanceBefore: 32, balanceAfter: 31 })
    const { wrapper } = await renderForm()
    expect(calls('/series/preview').at(-1)![1].body.rule).toEqual({
      freq: 'once',
      weekdays: [],
      startDate: '2030-06-08',
    })
    expect(wrapper.get('[data-testid="balance-note"]').text()).toContain(
      'Будет списано 1 событие из баланса событий. На балансе 32, останется 31.',
    )
    wrapper.unmount()
  })

  it('blocks publishing when the balance is empty and unblocks it for a draft', async () => {
    mocks.preview = previewOf({
      total: 1,
      published: 0,
      drafts: 1,
      balanceBefore: 0,
      balanceAfter: 0,
    })
    const { wrapper } = await renderForm()
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
    const note = wrapper.get('[data-testid="balance-note"]')
    expect(note.text()).toContain('Не хватает баланса событий')
    expect(submitButton(wrapper).attributes('aria-describedby')).toBe(note.attributes('id'))
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(calls('/events')).toHaveLength(0)

    await wrapper.get('button[role="switch"]').trigger('click')
    await settle()
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(calls('/events')[0]![1].body).toMatchObject({ status: 'draft' })
    wrapper.unmount()
  })

  it('does not block when balance charging is switched off', async () => {
    mocks.preview = previewOf({ total: 1, published: 1, balanceEnforced: false, balanceBefore: 0 })
    const { wrapper } = await renderForm()
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows the server answer when the balance ran out between preview and submit', async () => {
    mocks.eventPost = apiError('event_balance.insufficient')
    const { wrapper, emitted } = await renderForm()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не хватает баланса событий')
    expect(emitted.saved).toBeUndefined()
    wrapper.unmount()
  })
})

describe('create a series with preview', () => {
  it('sends the rule, template and exceptions to the preview and shows dates and the count', async () => {
    const { wrapper } = await renderForm()
    await choose(wrapper, 'Каждую неделю')
    const body = calls('/series/preview').at(-1)![1].body
    expect(body.rule).toEqual({
      freq: 'weekly',
      weekdays: [6],
      startDate: '2030-06-08',
      until: '2030-09-07',
    })
    expect(body.template).toMatchObject({
      type: 'training',
      title: 'Тренировка',
      startTime: '19:00',
      durationMinutes: 120,
      capacity: 12,
    })
    expect(body.exceptions).toEqual([])
    expect(wrapper.get('[data-testid="series-total"]').text()).toBe('2')
    expect(wrapper.text()).toContain('Сб 8.06')
    expect(wrapper.text()).toContain('Каждую неделю по субботам')
    wrapper.unmount()
  })

  it('counts "N раз" before exceptions and an excluded date shrinks the series (D-04 D)', async () => {
    const { wrapper } = await renderForm()
    await choose(wrapper, 'Каждую неделю')
    await choose(wrapper, 'N раз')
    await wrapper.get('#ev-series-count').setValue('8')
    await settle()
    expect(wrapper.text()).toContain('Повторения считаются до исключений')
    expect(calls('/series/preview').at(-1)![1].body.rule).toMatchObject({ count: 8 })
    expect(calls('/series/preview').at(-1)![1].body.rule).not.toHaveProperty('until')

    const chip = wrapper.get('[aria-label^="Сб 15.06"]')
    await chip.trigger('click')
    await settle()
    expect(calls('/series/preview').at(-1)![1].body.exceptions).toEqual(['2030-06-15'])
    expect(wrapper.find('[aria-label="Вернуть дату Сб 15.06"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('announces drafts from the balance and does not block the series (D-04)', async () => {
    mocks.preview = previewOf({
      total: 3,
      published: 1,
      drafts: 2,
      balanceBefore: 1,
      balanceAfter: 0,
      dates: [
        { date: '2030-06-08', startsAt: '', endsAt: '', status: 'published', draftReason: null },
        { date: '2030-06-15', startsAt: '', endsAt: '', status: 'draft', draftReason: 'balance' },
        { date: '2030-06-22', startsAt: '', endsAt: '', status: 'draft', draftReason: 'balance' },
      ],
    })
    const { wrapper } = await renderForm()
    await choose(wrapper, 'Каждую неделю')
    expect(wrapper.get('[data-testid="balance-note"]').text()).toContain(
      'Нужно 3 события, на балансе событий 1. Опубликуем первые 1, остальные 2 станут черновиками до пополнения.',
    )
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('creates the series once with a required idempotency key and emits the result', async () => {
    const { wrapper, emitted } = await renderForm()
    await choose(wrapper, 'Каждую неделю')
    expect(submitButton(wrapper).text()).toBe('Создать 2 события')
    await wrapper.get('form').trigger('submit')
    await settle()
    const options = calls('/series')[0]![1]
    expect(options.body.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(options.body.rule).toMatchObject({ freq: 'weekly', weekdays: [6] })
    expect(calls('/events')).toHaveLength(0)
    expect(emitted.seriesCreated).toHaveLength(1)
    expect(emitted.seriesCreated![0]![0]).toMatchObject({ total: 2, published: 2, replayed: false })
    wrapper.unmount()
  })

  it('sends bodies that the API schemas accept (contract with 20.1.3, 19.2.3 and 20.2.2)', async () => {
    mocks.settings = settings({ defaultJoinMode: 'invite' })
    const { wrapper } = await renderForm()
    await wrapper.get('[aria-label="Уровень игроков"]').trigger('click')
    await wrapper
      .findAll('[role="option"]')
      .find((o) => o.text().includes('В3'))!
      .trigger('click')
    await choose(wrapper, 'Свободная')
    await choose(wrapper, 'Каждую неделю')
    await wrapper.get('form').trigger('submit')
    await settle()
    const preview = calls('/series/preview').at(-1)![1].body
    expect(() => PreviewSeriesInput.parse(preview)).not.toThrow()
    const created = calls('/series')[0]![1].body
    const parsed = CreateSeriesInput.parse(created)
    expect(parsed.template).toMatchObject({ level: 'v3', joinMode: 'open', startTime: '19:00' })

    await choose(wrapper, 'Один раз')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(() => CreateEventInput.parse(calls('/events')[0]![1].body)).not.toThrow()
    wrapper.unmount()
  })

  it('reuses the same idempotency key when the same request is retried after a failure', async () => {
    mocks.seriesPost = Object.assign(new Error('offline'), { statusCode: 503, data: {} })
    const { wrapper } = await renderForm()
    await choose(wrapper, 'Каждую неделю')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toBeTruthy()
    await wrapper.get('form').trigger('submit')
    await settle()
    const keys = calls('/series').map(([, o]) => o.body.idempotencyKey)
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
    wrapper.unmount()
  })

  it('uses a new key after the request changed, so the server does not answer 409', async () => {
    mocks.seriesPost = Object.assign(new Error('offline'), { statusCode: 503, data: {} })
    const { wrapper } = await renderForm()
    await choose(wrapper, 'Каждую неделю')
    await wrapper.get('form').trigger('submit')
    await settle()
    await wrapper.get('#ev-cap').setValue('14')
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    const keys = calls('/series').map(([, o]) => o.body.idempotencyKey)
    expect(keys[0]).not.toBe(keys[1])
    wrapper.unmount()
  })

  it('keeps the entered values and shows a clear message for a rule the server rejects', async () => {
    mocks.seriesPost = apiError('series.too_many_dates', 422)
    const { wrapper } = await renderForm()
    await choose(wrapper, 'Каждую неделю')
    await wrapper.get('#ev-title').setValue('Среда — основа')
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('366')
    expect((wrapper.get('#ev-title').element as HTMLInputElement).value).toBe('Среда — основа')
    wrapper.unmount()
  })

  it('shows a preview failure with a retry and does not allow creating blindly', async () => {
    mocks.preview = apiError('event.starts_in_past', 422)
    const { wrapper } = await renderForm()
    await choose(wrapper, 'Каждую неделю')
    expect(wrapper.text()).toContain('Время начала должно быть в будущем')
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
    mocks.preview = previewOf()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Повторить предпросмотр')!
      .trigger('click')
    await settle()
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('does not offer a series when the host does not allow it (Mini App until 21.1.2)', async () => {
    const { wrapper } = await renderForm({ allowSeries: false })
    expect(wrapper.find('[data-testid="series-block"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('validation and accessibility', () => {
  it('focuses the first invalid field, marks it and announces the error', async () => {
    const { wrapper } = await renderForm()
    await wrapper.get('#ev-cap').setValue('0')
    await wrapper.get('#ev-price').setValue('abc')
    await wrapper.get('form').trigger('submit')
    await settle()
    const cap = wrapper.get('#ev-cap')
    expect(cap.attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(cap.element)
    const describedBy = cap.attributes('aria-describedby')!
    expect(wrapper.get(`#${describedBy}`).attributes('role')).toBe('alert')
    expect(calls('/events')).toHaveLength(0)
    wrapper.unmount()
  })

  it('validates the repeat count and focuses it', async () => {
    const { wrapper } = await renderForm()
    await choose(wrapper, 'Каждую неделю')
    await choose(wrapper, 'N раз')
    await wrapper.get('#ev-series-count').setValue('0')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('#ev-series-count').attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(wrapper.get('#ev-series-count').element)
    expect(calls('/series')).toHaveLength(0)
    wrapper.unmount()
  })

  it('labels every control: all inputs have a label and the atoms have an accessible name', async () => {
    const { wrapper } = await renderForm()
    for (const input of wrapper.findAll('input')) {
      const id = input.attributes('id')
      expect(id, 'input without id').toBeTruthy()
      expect(wrapper.find(`label[for="${id}"]`).exists(), `label for #${id}`).toBe(true)
    }
    for (const control of wrapper.findAll('[role="combobox"], [role="switch"]')) {
      expect(
        control.attributes('aria-label') || control.attributes('aria-labelledby'),
        'atom without accessible name',
      ).toBeTruthy()
    }
    wrapper.unmount()
  })
})

describe('edit an event of a series', () => {
  const initial = {
    id: 71,
    organizationId: 30,
    title: 'Среда',
    type: 'training',
    startsAt: new Date('2030-06-12T16:00:00Z'),
    endsAt: new Date('2030-06-12T18:00:00Z'),
    capacity: 12,
    price: 1500,
    priceMode: 'fixed',
    targetAmount: null,
    currency: 'BYN',
    status: 'published',
    venueId: null,
    locationText: null,
    description: null,
    cancellationDeadlineHours: 6,
    cancellationAllowed: true,
    joinMode: 'open',
    level: null,
    seriesId: 5,
    seriesDate: '2030-06-12',
  } as unknown as Event

  it('explains series_date_locked in Russian and keeps the entered values', async () => {
    mocks.eventPost = apiError('event.series_date_locked')
    const { wrapper } = await renderForm({ submitLabel: 'Сохранить событие' }, initial)
    expect(wrapper.find('[data-testid="series-block"]').exists()).toBe(false)
    await wrapper.get('#ev-start').setValue('2030-06-13T19:00')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(calls('/events/71', 'PATCH')).toHaveLength(1)
    const alert = wrapper.get('[role="alert"]').text()
    expect(alert).toContain('входит в серию')
    expect(alert).toContain('правкой серии')
    expect((wrapper.get('#ev-start').element as HTMLInputElement).value).toBe('2030-06-13T19:00')
    wrapper.unmount()
  })

  it('does not fetch a series preview while editing', async () => {
    const { wrapper } = await renderForm({ submitLabel: 'Сохранить событие' }, initial)
    expect(calls('/series/preview')).toHaveLength(0)
    wrapper.unmount()
  })
})
