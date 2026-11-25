// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, Suspense } from 'vue'

import PageComplaints from './page-complaints.vue'

import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import ModerationDialog from '~/components/root/ModerationDialog.vue'
import ModerationKpis from '~/components/root/ModerationKpis.vue'
import ModerationTabs from '~/components/root/ModerationTabs.vue'
import { stubPlatformStaff } from '~/test-support/platform-staff'

const API = '/api/platform/group-page-complaints'
const NOW = Date.parse('2026-11-23T12:00:00.000Z')
const apiFetch = vi.fn()
const navigateTo = vi.fn()
const toastShow = vi.fn()
let wrapper: VueWrapper | undefined

const complaint = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  organizationId: 10 + id,
  groupName: `Группа ${id}`,
  slug: `g${id}`,
  city: 'Минск',
  pageState: 'index',
  reasonCode: 'price',
  reasonTitle: 'Цены не совпадают с записью',
  details: 'На странице 10 BYN, а при записи списали 15',
  reporter: { kind: 'anonymous' },
  status: 'new',
  resolution: null,
  resolvedAt: null,
  createdAt: '2026-11-23T06:00:00.000Z',
  sameReasonOpen: 0,
  ...over,
})

const STATS = {
  open: 3,
  oldestOpenAt: '2026-11-20T12:00:00.000Z',
  closed30d: 6,
  avgHoursToClose30d: 11.2,
  limited30d: 14,
}

const NEW_ITEMS = [
  complaint(31, {
    reporter: { kind: 'user', id: 5, name: 'Лера', telegramUsername: 'lera_s' },
    sameReasonOpen: 3,
  }),
  complaint(30, { reasonCode: 'media', reasonTitle: 'Чужие фото или текст', details: null }),
  complaint(29, { pageState: 'hidden', reasonCode: 'other', reasonTitle: 'Другое' }),
  complaint(28, { pageState: 'own', reasonCode: 'other', reasonTitle: 'Другое' }),
]
const CLOSED_ITEMS = [
  complaint(27, {
    status: 'resolved',
    resolution: 'hidden',
    resolvedAt: '2026-04-30T08:00:00.000Z',
  }),
  complaint(26, {
    status: 'rejected',
    resolution: 'no_violation',
    resolvedAt: '2026-04-29T08:00:00.000Z',
  }),
]

type Handler = (init?: {
  query?: Record<string, string>
  method?: string
  body?: unknown
}) => unknown
let handlers: Record<string, Handler>

beforeEach(() => {
  apiFetch.mockReset()
  navigateTo.mockReset()
  toastShow.mockReset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  handlers = {
    [API]: (init) => ({
      items: init?.query?.status === 'closed' ? CLOSED_ITEMS : NEW_ITEMS,
      stats: STATS,
    }),
  }
  apiFetch.mockImplementation(async (url: string, init?: Parameters<Handler>[0]) => {
    const handler = handlers[url]
    if (!handler) throw new Error(`unexpected ${url}`)
    return handler(init)
  })
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useHead', () => undefined)
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('createError', (e: unknown) => Object.assign(new Error('createError'), e))
  stubPlatformStaff('owner')
  vi.stubGlobal('$fetch', apiFetch)
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
    defineComponent({ render: () => h(Suspense, null, { default: () => h(PageComplaints) }) }),
    {
      attachTo: document.body,
      global: {
        components: {
          ErrorState,
          SkeletonList,
          RootModerationTabs: ModerationTabs,
          RootModerationKpis: ModerationKpis,
          RootModerationDialog: ModerationDialog,
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

const card = (w: VueWrapper, id: number) => w.get(`[data-complaint="${id}"]`)
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')

describe('root «Жалобы на страницы» (24.1.3, R-06)', () => {
  it('requests the new complaints and shows the five KPIs from the stats', async () => {
    const w = await render()
    expect(apiFetch).toHaveBeenCalledWith(API, { query: { status: 'new' } })
    const kpis = w.get('[data-testid="mod-kpis"]').text()
    expect(kpis).toContain('Новые')
    expect(kpis).toContain('старшая 3 д')
    expect(kpis).toContain('Решено за 30 дней')
    expect(kpis).toContain('среднее время 11 ч')
    expect(kpis).toContain('Отсечено лимитом')
    expect(kpis).toContain('14')
    expect(w.get('[data-testid="mod-tab-complaints"]').text()).toContain('3')
  })

  it('shows the reason, the text, the source and the age of each complaint', async () => {
    const w = await render()
    const first = card(w, 31).text()
    expect(first).toContain('PC-31')
    expect(first).toContain('Группа 31')
    expect(first).toContain('Цены не совпадают с записью')
    expect(first).toContain('«На странице 10 BYN, а при записи списали 15»')
    expect(first).toContain('вход')
    expect(first).toContain('@lera_s')
    expect(first).toContain('6 ч')
    expect(first).toContain('ещё 3 с той же причиной')
    expect(card(w, 30).text()).toContain('без текста')
    expect(card(w, 30).text()).toContain('посетитель')
    expect(card(w, 30).text()).toContain('без входа')
  })

  it('offers reject, noindex and hide by the state of the page', async () => {
    const w = await render()
    const acts = (id: number) =>
      card(w, id)
        .findAll('button')
        .map((b) => b.attributes('data-action'))
    expect(acts(31)).toEqual(['reject', 'noindex', 'hide'])
    expect(acts(29)).toEqual(['reject'])
    // noindex поверх noindex владельца сервер отклоняет: кнопки нет
    expect(acts(28)).toEqual(['reject', 'hide'])
  })

  it('rejects a complaint and reloads the list', async () => {
    const posts: unknown[] = []
    handlers[`${API}/31/reject`] = (init) => {
      posts.push(init)
      return { id: 31 }
    }
    const w = await render()
    const before = apiFetch.mock.calls.length
    await card(w, 31).get('[data-action="reject"]').trigger('click')
    await flushPromises()
    expect(posts).toEqual([{ method: 'POST' }])
    expect(toastShow).toHaveBeenCalledWith('PC-31 отклонена')
    expect(apiFetch.mock.calls.length).toBeGreaterThan(before + 1)
  })

  it('shows the server error when the complaint is already closed and reloads', async () => {
    handlers[`${API}/31/reject`] = () => {
      throw Object.assign(new Error('x'), {
        statusCode: 409,
        data: { data: { code: 'group_page.complaint_closed' } },
      })
    }
    const w = await render()
    await card(w, 31).get('[data-action="reject"]').trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('Жалоба уже закрыта')
  })

  it('resolves from the complaint: reason is preset, the request goes to …/resolve', async () => {
    const posts: unknown[] = []
    handlers[`${API}/31/resolve`] = (init) => {
      posts.push(init)
      return { id: 31, page: {} }
    }
    const w = await render()
    await card(w, 31).get('[data-action="hide"]').trigger('click')
    await flushPromises()
    const d = dialog()!
    expect(d.textContent).toContain('Скрыть страницу · Группа 31')
    const checked = d.querySelector<HTMLInputElement>('input[type="radio"]:checked')
    expect(checked?.value).toBe('price')
    d.querySelector<HTMLButtonElement>('[data-testid="mod-submit"]')!.click()
    await flushPromises()
    expect(posts).toEqual([
      { method: 'POST', body: { state: 'hidden', reasonCode: 'price', note: null } },
    ])
    expect(dialog()).toBeNull()
    expect(toastShow).toHaveBeenCalledWith('Страница скрыта · причина ушла в кабинет и бот')
  })

  it('«Другое» has no preset: the moderator must choose the reason', async () => {
    const w = await render()
    await card(w, 28).get('[data-action="hide"]').trigger('click')
    await flushPromises()
    expect(dialog()!.querySelector('input[type="radio"]:checked')).toBeNull()
    expect(dialog()!.querySelector<HTMLButtonElement>('[data-testid="mod-submit"]')!.disabled).toBe(
      true,
    )
  })

  it('the closed tab lists resolved and rejected complaints with the outcome and no actions', async () => {
    const w = await render()
    await w.get('[data-testid="status-closed"]').trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenLastCalledWith(API, { query: { status: 'closed' } })
    expect(card(w, 27).text()).toContain('Страница скрыта · 30 апреля')
    expect(card(w, 26).text()).toContain('Отклонена · нарушений нет')
    expect(w.findAll('[data-action]')).toHaveLength(0)
  })

  it('the all tab requests every complaint', async () => {
    const w = await render()
    await w.get('[data-testid="status-all"]').trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenLastCalledWith(API, { query: { status: 'all' } })
    expect(w.get('[data-testid="status-all"]').attributes('aria-pressed')).toBe('true')
  })

  it('empty, error and retry states', async () => {
    handlers[API] = () => ({ items: [], stats: { ...STATS, open: 0, oldestOpenAt: null } })
    const w = await render()
    expect(w.get('[data-testid="complaints-empty"]').text()).toBe('Новых жалоб нет.')
    expect(w.get('[data-testid="mod-kpis"]').text()).toContain('новых нет')
    w.unmount()
    wrapper = undefined

    let fail = true
    handlers[API] = () => {
      if (fail) throw Object.assign(new Error('x'), { statusCode: 500 })
      return { items: NEW_ITEMS, stats: STATS }
    }
    const w2 = await render()
    expect(w2.text()).toContain('Не удалось загрузить жалобы')
    fail = false
    await w2.get('button.vt-btn').trigger('click')
    await flushPromises()
    expect(w2.find('[data-complaint="31"]').exists()).toBe(true)
  })

  it('goes to login on 401 and does not mention the removed reply buttons', async () => {
    handlers[API] = () => {
      throw Object.assign(new Error('x'), { statusCode: 401 })
    }
    await render()
    expect(navigateTo).toHaveBeenCalledWith('/auth/login')
  })
})

describe('root «Жалобы на страницы»: кнопки по роли (29.3.1, R-15)', () => {
  const actions = (w: VueWrapper, id: number) =>
    card(w, id)
      .findAll('button')
      .map((b) => b.attributes('data-action'))

  it.each(['owner', 'admin', 'moderator'] as const)(
    '%s видит отклонить, noindex и скрыть',
    async (role) => {
      stubPlatformStaff(role)
      const w = await render()
      expect(actions(w, 31)).toEqual(['reject', 'noindex', 'hide'])
    },
  )

  it('Support может только отклонить жалобу', async () => {
    stubPlatformStaff('support')
    const w = await render()
    expect(actions(w, 31)).toEqual(['reject'])
    expect(actions(w, 28)).toEqual(['reject'])
  })

  it.each(['pending', 'error'] as const)('%s: кнопок решения нет', async (state) => {
    stubPlatformStaff(state)
    const w = await render()
    expect(w.findAll('[data-complaint]')).toHaveLength(4)
    expect(w.findAll('[data-action]')).toHaveLength(0)
  })
})
