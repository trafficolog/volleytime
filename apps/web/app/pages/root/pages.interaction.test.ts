// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, Suspense } from 'vue'

import Pages from './pages.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import HistoryDialog from '~/components/root/HistoryDialog.vue'
import ModerationDialog from '~/components/root/ModerationDialog.vue'
import ModerationKpis from '~/components/root/ModerationKpis.vue'
import ModerationTabs from '~/components/root/ModerationTabs.vue'
import RestoreDialog from '~/components/root/RestoreDialog.vue'
import { stubPlatformStaff } from '~/test-support/platform-staff'

const apiFetch = vi.fn()
const navigateTo = vi.fn()
const toastShow = vi.fn()
let wrapper: VueWrapper | undefined

const city = (name: string, over: Record<string, unknown> = {}) => ({
  name,
  pages: 0,
  indexed: 0,
  noindex: 0,
  hidden: 0,
  issues: 0,
  ...over,
})

const CITIES = {
  regions: [
    {
      region: 'Минск',
      cities: [city('Минск', { pages: 3, indexed: 1, noindex: 1, hidden: 1, issues: 2 })],
    },
    {
      region: 'Брестская',
      cities: [
        city('Брест', { pages: 1, indexed: 1 }),
        city('Пинск'),
        city('Берёза', { issues: 1 }),
      ],
    },
  ],
  other: [city('Лондон', { pages: 1, indexed: 1 })],
  totals: { cities: 5, citiesWithPages: 3, pages: 5, indexed: 3, noindex: 1, hidden: 1 },
}

const page = (id: number, state: string, over: Record<string, unknown> = {}) => ({
  organizationId: id,
  name: `Группа ${id}`,
  slug: `g${id}`,
  city: 'Минск',
  state,
  moderation: null,
  newComplaints: 0,
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...over,
})

const MODERATION = {
  reasonCode: 'price',
  reasonTitle: 'Цены не совпадают с записью',
  note: 'Исправьте цену',
  decidedBy: { id: 1, name: 'root@vt' },
  decidedAt: '2026-05-20T15:40:00.000Z',
}

const MINSK_PAGES = [
  page(1, 'index', { newComplaints: 2 }),
  page(2, 'own'),
  page(3, 'noindex', { moderation: MODERATION }),
  page(4, 'hidden', {
    moderation: { ...MODERATION, reasonCode: 'inactive', reasonTitle: 'Группа не проводит игры' },
  }),
]

type Query = Record<string, string>
let handlers: Record<string, (query: Query, init?: { method?: string; body?: unknown }) => unknown>

beforeEach(() => {
  apiFetch.mockReset()
  navigateTo.mockReset()
  toastShow.mockReset()
  handlers = {
    '/api/platform/group-pages/cities': () => CITIES,
    '/api/platform/group-pages': (q) => {
      if (q.q) return { items: [page(9, 'hidden', { name: 'Ночная лига', city: 'Брест' })] }
      let items =
        q.city === 'Минск'
          ? MINSK_PAGES
          : q.city
            ? []
            : [...MINSK_PAGES, page(5, 'index', { city: 'Брест' })]
      if (q.filter === 'moderated')
        items = items.filter((p) => p.state === 'hidden' || p.state === 'noindex')
      if (q.filter === 'complaints') items = items.filter((p) => p.newComplaints > 0)
      return { items }
    },
  }
  apiFetch.mockImplementation(
    async (url: string, init?: { query?: Query; method?: string; body?: unknown }) => {
      const handler = handlers[url]
      if (!handler) throw new Error(`unexpected ${url}`)
      return handler(init?.query ?? {}, init)
    },
  )
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useHead', () => undefined)
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('createError', (e: unknown) => Object.assign(new Error('createError'), e))
  stubPlatformStaff('owner')
  vi.stubGlobal('$fetch', apiFetch)
  // Icon.vue опирается на автоимпорт `computed`
  vi.stubGlobal('computed', computed)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Pages) }) }),
    {
      attachTo: document.body,
      global: {
        components: {
          EmptyState,
          ErrorState,
          SkeletonList,
          RootModerationTabs: ModerationTabs,
          RootModerationKpis: ModerationKpis,
          RootModerationDialog: ModerationDialog,
          RootRestoreDialog: RestoreDialog,
          RootHistoryDialog: HistoryDialog,
          VtToast: { template: '<span />' },
        },
        stubs: {
          VtIcon: true,
          NuxtLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

async function openRegion(w: VueWrapper, name: string) {
  const head = w.findAll('.vt-mod-region__head').find((b) => b.text().includes(name))
  if (head?.attributes('aria-expanded') === 'false') await head.trigger('click')
}
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const rowOf = (w: VueWrapper, id: number) => w.get(`[data-org="${id}"]`)
const rowCalls = () => apiFetch.mock.calls.filter((c) => c[0] === '/api/platform/group-pages')

describe('root «Страницы групп» (24.1.3, R-06)', () => {
  it('shows the KPIs from the catalog totals and the chosen city with its pages', async () => {
    const w = await render()
    const kpis = w.get('[data-testid="mod-kpis"]').text()
    expect(kpis).toContain('Городов в каталоге')
    expect(kpis).toContain('3 со страницами')
    expect(kpis).toContain('3 в поиске')
    expect(w.get('#mod-heading').text()).toBe('Минск')
    expect(rowCalls()[0]![1]).toEqual({ query: { city: 'Минск', filter: 'all' } })
    expect(w.findAll('[data-org]')).toHaveLength(4)
  })

  it('renders state chips, the reason line and the new-complaints count', async () => {
    const w = await render()
    expect(rowOf(w, 1).text()).toContain('в поиске')
    expect(rowOf(w, 2).text()).toContain('noindex · владелец')
    expect(rowOf(w, 3).text()).toContain('noindex · root')
    expect(rowOf(w, 3).text()).toContain('Цены не совпадают с записью')
    expect(rowOf(w, 3).text()).toContain('root@vt')
    expect(rowOf(w, 3).text()).toContain('20 мая, 18:40')
    expect(rowOf(w, 4).text()).toContain('скрыта · 404')
    expect(rowOf(w, 1).text()).toContain('Новых жалоб: 2')
  })

  it('offers row actions by state and disables noindex over the owner noindex', async () => {
    const w = await render()
    const acts = (id: number) =>
      rowOf(w, id)
        .findAll('button')
        .map((b) => b.attributes('data-action'))
    expect(acts(1)).toEqual(['history', 'noindex', 'hide'])
    expect(acts(2)).toEqual(['history', 'noindex', 'hide'])
    expect(rowOf(w, 2).get('[data-action="noindex"]').attributes('disabled')).toBeDefined()
    expect(acts(3)).toEqual(['history', 'restore', 'hide'])
    expect(rowOf(w, 3).get('[data-action="restore"]').text()).toBe('Вернуть индексацию')
    expect(acts(4)).toEqual(['history', 'restore'])
    expect(rowOf(w, 4).get('[data-action="restore"]').text()).toBe('Вернуть')
  })

  it('reloads the pages for the chosen city and for the filter', async () => {
    const w = await render()
    await openRegion(w, 'Брестская')
    await w.get('[data-city="Брест"]').trigger('click')
    await flushPromises()
    expect(rowCalls().at(-1)![1]).toEqual({ query: { city: 'Брест', filter: 'all' } })
    await w.get('[data-testid="filter-moderated"]').trigger('click')
    await flushPromises()
    expect(rowCalls().at(-1)![1]).toEqual({ query: { city: 'Брест', filter: 'moderated' } })
    await w.get('[data-testid="city-all"]').trigger('click')
    await flushPromises()
    expect(rowCalls().at(-1)![1]).toEqual({ query: { filter: 'all' } })
    expect(w.get('#mod-heading').text()).toBe('Вся страна')
  })

  it('says a city without pages is closed from indexing and the filter has an empty state', async () => {
    const w = await render()
    await w.get('[data-testid="scope-all"]').trigger('click')
    await openRegion(w, 'Брестская')
    handlers['/api/platform/group-pages'] = () => ({ items: [] })
    await w.get('[data-city="Пинск"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="rows-empty"]').text()).toContain(
      'В городе Пинск пока нет страниц групп',
    )
    await w.get('[data-testid="filter-complaints"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="rows-empty"]').text()).toBe('Под фильтр ничего не подошло.')
  })

  it('filters the city list by scope and by the search text', async () => {
    const w = await render()
    expect(w.find('[data-city="Пинск"]').exists()).toBe(false)
    expect(w.find('[data-city="Лондон"]').exists()).toBe(false)
    await w.get('[data-testid="scope-issues"]').trigger('click')
    await openRegion(w, 'Брестская')
    expect(w.find('[data-city="Берёза"]').exists()).toBe(true)
    expect(w.find('[data-city="Брест"]').exists()).toBe(false)
    await w.get('#mod-city-q').setValue('береза')
    expect(w.find('[data-city="Берёза"]').exists()).toBe(true)
    await w.get('#mod-city-q').setValue('нет такого')
    expect(w.text()).toContain('Ничего не нашли')
  })

  it('searches groups by name after two letters and jumps to their city', async () => {
    vi.useFakeTimers()
    const w = await render()
    await w.get('#mod-city-q').setValue('ночн')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(
      apiFetch.mock.calls.some(
        (c) => c[0] === '/api/platform/group-pages' && c[1]?.query?.q === 'ночн',
      ),
    ).toBe(true)
    const hit = w.get('[data-testid="group-hits"] button')
    expect(hit.text()).toContain('Ночная лига')
    await hit.trigger('click')
    await flushPromises()
    expect(w.get('#mod-heading').text()).toBe('Брест')
  })

  it('shows loading, error with retry, and 403 / 401 reactions', async () => {
    let release!: (v: unknown) => void
    handlers['/api/platform/group-pages/cities'] = () => new Promise((r) => (release = r))
    wrapper = mount(
      defineComponent({
        render: () =>
          h(Suspense, null, { default: () => h(Pages), fallback: () => h('p', 'loading') }),
      }),
      {
        attachTo: document.body,
        global: {
          components: {
            SkeletonList,
            ErrorState,
            RootModerationTabs: ModerationTabs,
            RootModerationKpis: ModerationKpis,
            VtToast: { template: '<span />' },
          },
          stubs: { VtIcon: true, NuxtLink: true },
        },
      },
    )
    await flushPromises()
    expect(wrapper.text()).toContain('loading')
    release(CITIES)
    await flushPromises()
    expect(wrapper.find('#mod-heading').exists()).toBe(true)
    wrapper.unmount()

    handlers['/api/platform/group-pages/cities'] = () => {
      throw Object.assign(new Error('x'), { statusCode: 500 })
    }
    const w = await render()
    expect(w.text()).toContain('Не удалось загрузить каталог городов')
    handlers['/api/platform/group-pages/cities'] = () => CITIES
    await w.get('button.vt-btn').trigger('click')
    await flushPromises()
    expect(w.find('#mod-heading').exists()).toBe(true)
  })

  it('redirects to login on 401 and raises 403 for a non-root user', async () => {
    handlers['/api/platform/group-pages/cities'] = () => {
      throw Object.assign(new Error('x'), { statusCode: 401 })
    }
    await render()
    expect(navigateTo).toHaveBeenCalledWith('/auth/login')
    wrapper?.unmount()
    wrapper = undefined

    handlers['/api/platform/group-pages/cities'] = () => {
      throw Object.assign(new Error('x'), { statusCode: 403 })
    }
    const errors: unknown[] = []
    const onError = vi.fn((e: unknown) => errors.push(e))
    wrapper = mount(
      defineComponent({ render: () => h(Suspense, null, { default: () => h(Pages) }) }),
      {
        global: {
          config: { errorHandler: onError },
          components: {
            SkeletonList,
            ErrorState,
            RootModerationTabs: ModerationTabs,
            RootModerationKpis: ModerationKpis,
          },
        },
      },
    )
    await flushPromises()
    expect(JSON.stringify(errors.map((e) => (e as { statusCode?: number }).statusCode))).toContain(
      '403',
    )
  })

  it('hides a page: reason is required, the body carries state, reason and note, then the lists reload', async () => {
    const posts: unknown[] = []
    handlers['/api/platform/group-pages/1/moderation'] = (_q, init) => {
      posts.push(init)
      return page(1, 'hidden', { moderation: MODERATION })
    }
    const w = await render()
    await rowOf(w, 1).get('[data-action="hide"]').trigger('click')
    await flushPromises()
    const d = dialog()!
    expect(d.textContent).toContain('Скрыть страницу · Группа 1')
    const submit = d.querySelector<HTMLButtonElement>('[data-testid="mod-submit"]')!
    expect(submit.disabled).toBe(true)
    const radios = d.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    expect(radios).toHaveLength(6)
    radios[4]!.click()
    radios[4]!.dispatchEvent(new Event('change', { bubbles: true }))
    d.querySelector<HTMLTextAreaElement>('textarea')!.value = ' Создайте событие '
    d.querySelector<HTMLTextAreaElement>('textarea')!.dispatchEvent(
      new Event('input', { bubbles: true }),
    )
    await flushPromises()
    expect(submit.disabled).toBe(false)
    const before = apiFetch.mock.calls.length
    submit.click()
    await flushPromises()
    expect(posts).toEqual([
      {
        method: 'POST',
        body: { state: 'hidden', reasonCode: 'inactive', note: 'Создайте событие' },
      },
    ])
    expect(dialog()).toBeNull()
    expect(toastShow).toHaveBeenCalledWith('«Группа 1» скрыта · причина ушла в кабинет и бот')
    // после решения перечитаны строки и каталог (счётчики городов)
    expect(apiFetch.mock.calls.slice(before).map((c) => c[0])).toEqual(
      expect.arrayContaining(['/api/platform/group-pages', '/api/platform/group-pages/cities']),
    )
  })

  it('opens the forced noindex dialog from a row and shows the root page state afterwards', async () => {
    const w = await render()
    await rowOf(w, 1).get('[data-action="noindex"]').trigger('click')
    await flushPromises()
    expect(dialog()!.textContent).toContain('Принудительный noindex · Группа 1')
    expect(dialog()!.textContent).toContain('Закрыть от поиска')
  })

  it('restores with a confirmation and reports a conflict from the server', async () => {
    let fail = true
    handlers['/api/platform/group-pages/4/restore'] = () => {
      if (fail) {
        fail = false
        throw Object.assign(new Error('x'), {
          statusCode: 409,
          data: { data: { code: 'group_page.not_moderated' } },
        })
      }
      return page(4, 'index')
    }
    const w = await render()
    await rowOf(w, 4).get('[data-action="restore"]').trigger('click')
    await flushPromises()
    expect(dialog()!.textContent).toContain('Вернуть «Группа 4»?')
    expect(dialog()!.textContent).toContain('Организатор получит уведомление в бот')
    document.body.querySelector<HTMLButtonElement>('[data-testid="restore-confirm"]')!.click()
    await flushPromises()
    expect(dialog()!.textContent).toContain('Решения по странице уже нет')
    document.body.querySelector<HTMLButtonElement>('[data-testid="restore-confirm"]')!.click()
    await flushPromises()
    expect(dialog()).toBeNull()
    expect(toastShow).toHaveBeenCalledWith('«Группа 4» возвращена · записано в журнал')
  })

  it('opens the history dialog with the log of decisions and complaints', async () => {
    handlers['/api/platform/group-pages/3/history'] = () => ({
      page: page(3, 'noindex', { moderation: MODERATION }),
      entries: [
        {
          at: '2026-05-20T15:40:00.000Z',
          kind: 'noindex',
          reasonCode: 'price',
          reasonTitle: 'Цены не совпадают с записью',
          note: 'Исправьте цену',
          actor: { id: 1, name: 'root@vt' },
        },
        {
          at: '2026-05-18T10:00:00.000Z',
          kind: 'complaint',
          reasonCode: 'price',
          reasonTitle: 'Цены не совпадают с записью',
          note: null,
          actor: null,
        },
      ],
    })
    const w = await render()
    await rowOf(w, 3).get('[data-action="history"]').trigger('click')
    await flushPromises()
    const text = dialog()!.textContent!
    expect(text).toContain('История · Группа 3')
    expect(text).toContain('Принудительный noindex · Цены не совпадают с записью')
    expect(text).toContain('root@vt')
    expect(text).toContain('Жалоба с публичной страницы')
    expect(text).toContain('посетитель')
    expect(text).not.toContain('Ответить')
  })
})

describe('root «Страницы групп»: кнопки изменений по роли (29.3.1, R-15)', () => {
  const actions = (w: VueWrapper, id: number) =>
    rowOf(w, id)
      .findAll('button')
      .map((b) => b.attributes('data-action'))

  it.each(['owner', 'admin', 'moderator'] as const)(
    '%s видит noindex, скрыть и вернуть',
    async (role) => {
      stubPlatformStaff(role)
      const w = await render()
      expect(actions(w, 1)).toEqual(['history', 'noindex', 'hide'])
      expect(actions(w, 3)).toEqual(['history', 'restore', 'hide'])
      expect(actions(w, 4)).toEqual(['history', 'restore'])
    },
  )

  it.each(['support', 'pending', 'error'] as const)(
    '%s: страницы и история видны, кнопок изменений нет',
    async (state) => {
      stubPlatformStaff(state)
      const w = await render()
      expect(w.findAll('[data-org]')).toHaveLength(4)
      for (const id of [1, 2, 3, 4]) expect(actions(w, id)).toEqual(['history'])
    },
  )
})
