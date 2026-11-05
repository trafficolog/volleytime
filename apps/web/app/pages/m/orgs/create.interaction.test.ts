// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'

import { createMainButton } from '../../../utils/telegram-shell'

import Create from './create.vue'

/** Task 21.1.7: мастер «Своя группа» (3 шага); группа создаётся на переходе 1→2 (решение 2026-11-05). */

let wrapper: VueWrapper | undefined

interface PreviewReply {
  published: number
  drafts: number
  total: number
  balanceBefore: number
  balanceAfter: number
}
const PREVIEW: PreviewReply = {
  published: 5,
  drafts: 0,
  total: 5,
  balanceBefore: 5,
  balanceAfter: 0,
}

interface Opts {
  telegram?: boolean
  create?: () => Promise<{ id: number; name?: string; defaultTimezone?: string }>
  preview?: () => Promise<unknown>
  series?: () => Promise<unknown>
  invite?: () => Promise<unknown>
}

function stubPage(opts: Opts = {}) {
  const main = {
    handlers: new Set<() => void>(),
    setText: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    showProgress: vi.fn(),
    hideProgress: vi.fn(),
    onClick: vi.fn((cb: () => void) => void main.handlers.add(cb)),
    offClick: vi.fn((cb: () => void) => void main.handlers.delete(cb)),
  }
  const create = vi.fn(
    opts.create ??
      (async () => ({ id: 7, name: 'Волейбол по средам', defaultTimezone: 'Europe/Minsk' })),
  )
  const calls: { url: string; method: string; body?: Record<string, unknown> }[] = []
  const fetchStub = vi.fn(
    async (url: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body })
      if (url.endsWith('/event-balance')) return { eventBalance: { balance: 5 } }
      if (url.endsWith('/series/preview')) return (opts.preview ?? (async () => PREVIEW))()
      if (url.endsWith('/series'))
        return (
          opts.series ??
          (async () => ({
            total: 5,
            published: 5,
            drafts: 0,
            venueConflicts: 0,
            balanceAfter: 0,
            replayed: false,
          }))
        )()
      if (url.endsWith('/invites'))
        return (
          opts.invite ?? (async () => ({ deeplinkUrl: 'https://t.me/test_bot?start=inv_abc' }))
        )()
      throw new Error(`unexpected ${method} ${url}`)
    },
  )
  const haptic = vi.fn()
  const navigateTo = vi.fn()
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('watchEffect', watchEffect)
  vi.stubGlobal('onMounted', onMounted)
  vi.stubGlobal('onUnmounted', onUnmounted)
  vi.stubGlobal('nextTick', nextTick)
  vi.stubGlobal('createMainButton', createMainButton)
  vi.stubGlobal('apiErrorMessage', (_e: unknown, fallback = 'Ошибка') => fallback)
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('$fetch', fetchStub)
  vi.stubGlobal('useOrganizations', () => ({ create }))
  vi.stubGlobal('useTelegram', () => ({
    haptic,
    isTelegram: ref(opts.telegram ?? false),
    webApp: { MainButton: main },
  }))
  return { main, haptic, create, calls, navigateTo }
}

function mountPage() {
  wrapper = mount(Create, {
    attachTo: document.body,
    global: {
      stubs: {
        VtIcon: true,
        VtMiniHeader: {
          props: ['title', 'sub', 'back'],
          template: '<header><h1>{{ title }}</h1><p data-sub>{{ sub }}</p></header>',
        },
      },
    },
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

const next = (page: VueWrapper) => page.find('[data-wizard-next]')
const text = (page: VueWrapper) => page.text()

async function toStep2(page: VueWrapper, name = 'Волейбол по средам') {
  await page.find('#org-name').setValue(name)
  await next(page).trigger('click')
  await flushPromises()
}

describe('step 1 «Группа»', () => {
  it('shows header «Шаг 1 из 3», the step indicator, city default and a disabled «Дальше» without name', async () => {
    stubPage()
    const page = mountPage()
    await flushPromises()
    expect(page.find('[data-sub]').text()).toBe('Шаг 1 из 3')
    const steps = page.findAll('[data-wizard-step]')
    expect(steps.map((s) => s.text())).toEqual(['Группа', 'Расписание', 'Готово'])
    expect(steps[0]!.attributes('aria-current')).toBe('step')
    expect(steps[1]!.attributes('aria-current')).toBeUndefined()
    expect((page.find('#org-city').element as HTMLInputElement).value).toBe('Минск')
    expect(next(page).attributes('disabled')).toBeDefined()
    await page.find('#org-name').setValue('а')
    expect(next(page).attributes('disabled')).toBeDefined()
    await page.find('#org-name').setValue('Ср')
    expect(next(page).attributes('disabled')).toBeUndefined()
  })

  it('creates the group once on «Дальше» and ignores a second click while the request runs', async () => {
    let resolve!: (v: { id: number }) => void
    const { create, calls } = stubPage({ create: () => new Promise((r) => (resolve = r)) })
    const page = mountPage()
    await page.find('#org-name').setValue('  Волейбол Минск ')
    await next(page).trigger('click')
    await next(page).trigger('click')
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({ name: 'Волейбол Минск', city: 'Минск' })
    expect(page.find('[data-sub]').text()).toBe('Шаг 1 из 3')

    resolve({ id: 7 })
    await flushPromises()
    expect(page.find('[data-sub]').text()).toBe('Шаг 2 из 3')
    expect(calls.some((c) => c.url === '/api/organizations/7/event-balance')).toBe(true)
  })

  it('shows the API error, stays on step 1, and a retry creates the group (no duplicate)', async () => {
    let attempts = 0
    const { create, haptic } = stubPage({
      create: async () => {
        if (attempts++ === 0) throw new Error('boom')
        return { id: 9 }
      },
    })
    const page = mountPage()
    await page.find('#org-name').setValue('Ср Волейбол')
    await next(page).trigger('click')
    await flushPromises()
    expect(page.find('[role="alert"]').text()).toBe('Не удалось создать группу')
    expect(haptic).toHaveBeenCalledWith('error')
    expect(page.find('[data-sub]').text()).toBe('Шаг 1 из 3')

    await next(page).trigger('click')
    await flushPromises()
    expect(page.find('[data-sub]').text()).toBe('Шаг 2 из 3')
    expect(create).toHaveBeenCalledTimes(2)
  })
})

describe('step 2 «Расписание»', () => {
  it('«Назад» keeps the group and «Дальше» again does not create a second one; step data is kept', async () => {
    const { create } = stubPage()
    const page = mountPage()
    await toStep2(page)
    expect(create).toHaveBeenCalledTimes(1)

    await page.find('[data-day="5"]').trigger('click')
    await page.find('[data-wizard-back]').trigger('click')
    await flushPromises()
    expect(page.find('[data-sub]').text()).toBe('Шаг 1 из 3')
    expect((page.find('#org-name').element as HTMLInputElement).value).toBe('Волейбол по средам')
    expect(page.find('#org-name').attributes('readonly')).toBeDefined()

    await next(page).trigger('click')
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect(page.find('[data-sub]').text()).toBe('Шаг 2 из 3')
    expect(page.find('[data-day="5"]').attributes('aria-pressed')).toBe('true')
  })

  it('days are aria-pressed toggles, defaults Wed 20:00 / 14 seats; preview body uses engineering defaults', async () => {
    const { calls } = stubPage()
    const page = mountPage()
    await toStep2(page)
    expect(page.find('[data-day="3"]').attributes('aria-pressed')).toBe('true')
    expect(page.find('[data-day="1"]').attributes('aria-pressed')).toBe('false')
    expect((page.find('#wizard-time').element as HTMLInputElement).value).toBe('20:00')
    expect((page.find('#wizard-seats').element as HTMLInputElement).value).toBe('14')
    const preview = calls.filter((c) => c.url === '/api/organizations/7/series/preview').at(-1)!
    expect(preview.method).toBe('POST')
    expect(preview.body).toMatchObject({
      rule: { freq: 'weekly', weekdays: [3] },
      template: {
        type: 'training',
        title: 'Волейбол по средам',
        startTime: '20:00',
        durationMinutes: 120,
        capacity: 14,
      },
    })
  })

  it('shows published / drafts / balance after from the series preview', async () => {
    stubPage({
      preview: async () => ({
        ...PREVIEW,
        total: 9,
        published: 5,
        drafts: 4,
        balanceAfter: 0,
        balanceEnforced: true,
        dates: [],
      }),
    })
    const page = mountPage()
    await toStep2(page)
    const box = page.find('[data-series-preview]')
    expect(box.text()).toContain('5')
    expect(box.find('[data-preview-published]').text()).toBe('5')
    expect(box.find('[data-preview-drafts]').text()).toBe('4')
    expect(box.find('[data-preview-balance-after]').text()).toBe('0')
  })

  it('creates the series on «Далее» with an idempotency key and shows the API result on step 3', async () => {
    const { calls } = stubPage({
      series: async () => ({
        total: 5,
        published: 3,
        drafts: 2,
        venueConflicts: 0,
        balanceAfter: 2,
        replayed: false,
      }),
    })
    const page = mountPage()
    await toStep2(page)
    await next(page).trigger('click')
    await flushPromises()
    const post = calls.find((c) => c.url === '/api/organizations/7/series')!
    expect(post.method).toBe('POST')
    expect(String(post.body?.idempotencyKey)).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(page.find('[data-sub]').text()).toBe('Шаг 3 из 3')
    const done = page.find('[data-wizard-done]')
    expect(done.text()).toContain('Волейбол по средам')
    expect(done.text()).toContain('Минск')
    expect(done.text()).toContain('Ср')
    expect(page.find('[data-series-result]').text()).toContain('опубликовано 3, черновиков 2')
    expect(page.find('[data-series-result]').text()).toContain('осталось 2')
    // подарок берётся из баланса группы, а не из константы
    expect(page.find('[data-gift]').text()).toContain('5')
  })

  it('series failure keeps the group, shows a message, retry reuses the key; skip goes to step 3 without series', async () => {
    const series = vi.fn().mockRejectedValueOnce(new Error('fail'))
    const { calls, create } = stubPage({ series })
    series.mockRejectedValueOnce(new Error('fail again'))
    const page = mountPage()
    await toStep2(page)
    await next(page).trigger('click')
    await flushPromises()
    expect(page.find('[data-series-error]').text()).toContain('Группа уже создана')
    expect(page.find('[data-sub]').text()).toBe('Шаг 2 из 3')
    await next(page).trigger('click')
    await flushPromises()
    const keys = calls
      .filter((c) => c.url === '/api/organizations/7/series')
      .map((c) => c.body?.idempotencyKey)
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])

    await page.find('[data-wizard-skip]').trigger('click')
    await flushPromises()
    expect(page.find('[data-sub]').text()).toBe('Шаг 3 из 3')
    expect(page.find('[data-series-result]').exists()).toBe(false)
    expect(text(page)).toContain('расписание позже')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('«Пропустить» creates no series; the gift balance and the invite link still show', async () => {
    const { calls } = stubPage()
    const page = mountPage()
    await toStep2(page)
    await page.find('[data-wizard-skip]').trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.url === '/api/organizations/7/series')).toBe(false)
    expect(page.find('[data-gift]').text()).toContain('5')
    expect(page.find('[data-invite-link]').text()).toBe('https://t.me/test_bot?start=inv_abc')
  })

  it('changing the schedule gives the next attempt a new idempotency key', async () => {
    const series = vi.fn().mockRejectedValue(new Error('fail'))
    const { calls } = stubPage({ series })
    const page = mountPage()
    await toStep2(page)
    await next(page).trigger('click')
    await flushPromises()
    await page.find('[data-day="5"]').trigger('click')
    await flushPromises()
    await next(page).trigger('click')
    await flushPromises()
    const keys = calls
      .filter((c) => c.url === '/api/organizations/7/series')
      .map((c) => c.body?.idempotencyKey)
    expect(keys[0]).not.toBe(keys[1])
  })

  it('preview error disables «Дальше», offers retry and keeps «Пропустить»', async () => {
    const preview = vi.fn().mockRejectedValueOnce(new Error('x'))
    stubPage({ preview })
    preview.mockRejectedValueOnce(new Error('x'))
    const page = mountPage()
    await toStep2(page)
    expect(page.find('[data-preview-error]').exists()).toBe(true)
    expect(next(page).attributes('disabled')).toBeDefined()
    expect(page.find('[data-wizard-skip]').attributes('disabled')).toBeUndefined()
  })

  it('does not call the series API for invalid fields', async () => {
    const { calls } = stubPage()
    const page = mountPage()
    await toStep2(page)
    await page.find('#wizard-seats').setValue('0')
    await flushPromises()
    expect(next(page).attributes('disabled')).toBeDefined()
    expect(calls.some((c) => c.url.endsWith('/series'))).toBe(false)
  })
})

describe('step 3 «Готово»', () => {
  it('copies the invite link and «Готово» opens the group in organizer mode; no «Назад»', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { navigateTo } = stubPage()
    const page = mountPage()
    await toStep2(page)
    await page.find('[data-wizard-skip]').trigger('click')
    await flushPromises()
    expect(page.find('[data-wizard-back]').exists()).toBe(false)
    await page.find('[data-invite-copy]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('https://t.me/test_bot?start=inv_abc')
    await next(page).trigger('click')
    expect(navigateTo).toHaveBeenCalledWith('/m/orgs/7')
  })

  it('shows an invite error with retry', async () => {
    const invite = vi.fn().mockRejectedValueOnce(new Error('x'))
    stubPage({ invite })
    const page = mountPage()
    await toStep2(page)
    await page.find('[data-wizard-skip]').trigger('click')
    await flushPromises()
    expect(page.find('[data-invite-error]').exists()).toBe(true)
    invite.mockResolvedValueOnce({ deeplinkUrl: 'https://t.me/test_bot?start=inv_2' })
    await page.find('[data-invite-retry]').trigger('click')
    await flushPromises()
    expect(page.find('[data-invite-link]').text()).toContain('inv_2')
  })
})

describe('accessibility and Telegram', () => {
  it('moves focus to the step heading on every step change', async () => {
    stubPage()
    const page = mountPage()
    await toStep2(page)
    await nextTick()
    expect(document.activeElement?.id).toBe('wizard-heading')
    expect(document.activeElement?.textContent).toContain('Когда играете')
  })

  it('in Telegram the main button drives the wizard and the footer primary button is hidden', async () => {
    const { main, create } = stubPage({ telegram: true })
    const page = mountPage()
    await flushPromises()
    expect(next(page).exists()).toBe(false)
    expect(main.show).toHaveBeenCalled()
    expect(main.setText).toHaveBeenLastCalledWith('Дальше')
    await page.find('#org-name').setValue('Волейбол Минск')
    for (const handler of main.handlers) handler()
    await flushPromises()
    for (const handler of main.handlers) handler()
    expect(create).toHaveBeenCalledTimes(1)
    expect(main.setText).toHaveBeenLastCalledWith('Дальше')

    page.unmount()
    wrapper = undefined
    expect(main.handlers.size).toBe(0)
    expect(main.hide).toHaveBeenCalled()
  })
})
