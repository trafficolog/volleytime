// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  Suspense,
  watch,
} from 'vue'

import Billing from './billing.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import VtToggle from '~/components/vt/Toggle.vue'

const API = '/api/platform/event-balance/packages'
const route = reactive<{ query: Record<string, string> }>({ query: {} })
const apiFetch = vi.fn()
const toastShow = vi.fn()
const refresh = vi.fn()
let wrapper: VueWrapper | undefined
let catalog: unknown

const pkg = (over: Record<string, unknown>) => ({
  id: 1,
  code: 'events_10',
  units: 10,
  amount: 5000,
  currency: 'BYN',
  badge: null,
  visible: true,
  archivedAt: null,
  sortOrder: 10,
  version: 1,
  createdAt: '2026-11-19T10:00:00.000Z',
  updatedAt: '2026-11-19T10:00:00.000Z',
  pricePerEvent: 500,
  sales: [],
  ...over,
})

const CATALOG = {
  packages: [
    pkg({ sales: [{ currency: 'BYN', sold: 3, revenue: 15000 }] }),
    pkg({
      id: 2,
      code: 'events_30',
      units: 30,
      amount: 12000,
      badge: 'popular',
      version: 4,
      pricePerEvent: 400,
      sales: [{ currency: 'BYN', sold: 7, revenue: 84000 }],
    }),
    pkg({
      id: 3,
      code: 'events_100',
      units: 100,
      amount: 35000,
      badge: 'discount',
      pricePerEvent: 350,
    }),
    pkg({
      id: 4,
      code: 'events_200',
      units: 200,
      amount: 60000,
      visible: false,
      pricePerEvent: 300,
    }),
  ],
  unattributed: [{ currency: 'BYN', sold: 2, revenue: 9000 }],
}

const HISTORY = {
  entries: [
    {
      id: 11,
      createdAt: '2026-11-19T09:02:00.000Z',
      action: 'event_balance_package.updated',
      packageId: 2,
      packageCode: 'events_30',
      actor: { id: 1, name: 'Root', email: 'root@vt.test' },
      oldValue: { amount: 13000 },
      newValue: { amount: 12000 },
    },
  ],
  nextCursor: null,
}

beforeEach(() => {
  route.query = {}
  catalog = CATALOG
  toastShow.mockReset()
  refresh.mockReset().mockResolvedValue(undefined)
  apiFetch.mockReset().mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (url === `${API}/history`) return HISTORY
    if (opts?.method) return pkg({})
    throw new Error(`unexpected ${url}`)
  })
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useHead', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({
    push: async (to: { query: Record<string, string> }) => {
      route.query = to.query
    },
  }))
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
  vi.stubGlobal('useFetch', async () => ({
    data: ref(catalog),
    pending: ref(false),
    error: ref(null),
    refresh,
  }))
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('createError', (e: unknown) => e)
  for (const [name, value] of Object.entries({
    computed,
    watch,
    ref,
    reactive,
    nextTick,
    onBeforeUnmount,
  })) {
    vi.stubGlobal(name, value)
  }
  vi.stubGlobal('$fetch', apiFetch)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Billing) }) }),
    {
      attachTo: document.body,
      global: {
        components: { ErrorState, SkeletonList, EmptyState, VtToggle },
        stubs: { VtIcon: true, VtToast: true },
      },
    },
  )
  await flushPromises()
  return wrapper
}

const byText = (w: VueWrapper, text: string) =>
  w.findAll('button').find((b) => b.text().replace(/\s+/g, ' ').trim() === text)
const row = (w: VueWrapper, code: string) => w.get(`[data-testid="package-row-${code}"]`)

describe('root balance and tariffs (R-02, 22.2.1)', () => {
  it('lists packages with price, price per event, badge, state, sales and revenue', async () => {
    const w = await render()
    const first = row(w, 'events_10').text()
    expect(first).toContain('10')
    expect(first).toContain('50 Br')
    expect(first).toContain('5,00 Br за событие')
    expect(first).toContain('+150 Br')
    const popular = row(w, 'events_30').text()
    expect(popular).toContain('Популярный')
    expect(popular).toContain('+840 Br')
    // фиксированная подпись «Скидка», а не «−N%» из макета
    expect(row(w, 'events_100').text()).toContain('Скидка')
    expect(row(w, 'events_100').text()).not.toContain('−')
    const draft = row(w, 'events_200')
    expect(draft.text()).toContain('черновик')
    expect(draft.text()).toContain('—')
    expect(w.get('[data-testid="package-row-unattributed"]').text()).toContain(
      'Без пакета (до каталога)',
    )
    expect(w.text()).not.toMatch(/credit/i)
  })

  it('opens «Новый пакет», validates, and posts a draft with the badge and a price in Br', async () => {
    const w = await render()
    await byText(w, 'Новый пакет')!.trigger('click')
    expect(w.get('h2#package-form-title').text()).toBe('Новый пакет')
    await w.get('form').trigger('submit')
    expect(w.text()).toContain('Целое число событий от 1 до 10 000')
    expect(w.text()).toContain('Цена: число от 0 до 100 000')
    expect(apiFetch).not.toHaveBeenCalled()

    await w.get('input[name="units"]').setValue('60')
    await w.get('input[name="price"]').setValue('210,50')
    await byText(w, 'Скидка')!.trigger('click')
    expect(w.text()).toContain('3,51 Br за событие') // превью: 21050 / 60
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(API, {
      method: 'POST',
      body: { units: 60, amount: 21050, badge: 'discount', visible: false },
    })
    expect(toastShow).toHaveBeenCalledWith('Пакет создан как черновик')
    expect(refresh).toHaveBeenCalled()
    expect(w.find('form').exists()).toBe(false)
  })

  it('shows the units_taken message under the form and keeps it open', async () => {
    apiFetch.mockRejectedValue({
      statusCode: 409,
      data: { data: { code: 'event_balance_package.units_taken' } },
    })
    const w = await render()
    await byText(w, 'Новый пакет')!.trigger('click')
    await w.get('input[name="units"]').setValue('30')
    await w.get('input[name="price"]').setValue('1')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('количеством событий')
    expect(w.find('form').exists()).toBe(true)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('edits only price, badge and visibility: units are read-only and the patch carries the version', async () => {
    const w = await render()
    await row(w, 'events_30').get('button[aria-label^="Изменить"]').trigger('click')
    expect(w.get('h2#package-form-title').text()).toBe('Изменить пакет')
    const units = w.get('input[name="units"]')
    expect(units.attributes('readonly')).toBeDefined()
    expect((units.element as HTMLInputElement).value).toBe('30')
    await w.get('input[name="price"]').setValue('130')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${API}/2`, {
      method: 'PATCH',
      body: { version: 4, amount: 13000 },
    })
    expect(toastShow).toHaveBeenCalledWith('Пакет сохранён')
  })

  it('«Дублировать» opens an empty quantity and posts to the duplicate route', async () => {
    const w = await render()
    await row(w, 'events_30').get('button[aria-label^="Дублировать"]').trigger('click')
    expect(w.get('h2#package-form-title').text()).toBe('Копия пакета')
    expect((w.get('input[name="units"]').element as HTMLInputElement).value).toBe('')
    expect((w.get('input[name="price"]').element as HTMLInputElement).value).toBe('120')
    await w.get('input[name="units"]').setValue('60')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${API}/2/duplicate`, {
      method: 'POST',
      body: { units: 60, amount: 12000 },
    })
  })

  it('hides and shows a package from the storefront with the current version', async () => {
    const w = await render()
    await byText(w, 'Скрыть')!.trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${API}/1`, {
      method: 'PATCH',
      body: { version: 1, visible: false },
    })
    expect(toastShow).toHaveBeenCalledWith('Пакет скрыт из витрины')
    apiFetch.mockClear()
    await row(w, 'events_200').get('button[aria-label^="Показать"]').trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${API}/4`, {
      method: 'PATCH',
      body: { version: 1, visible: true },
    })
  })

  it('asks for confirmation before «Удалить» and archives with the version only after it', async () => {
    const w = await render()
    await row(w, 'events_100').get('button[aria-label^="Удалить"]').trigger('click')
    const dialog = w.get('[role="alertdialog"]')
    expect(dialog.text()).toContain('уйдёт в архив')
    expect(apiFetch).not.toHaveBeenCalled()
    await byText(w, 'Отмена')!.trigger('click')
    expect(w.find('[role="alertdialog"]').exists()).toBe(false)

    await row(w, 'events_100').get('button[aria-label^="Удалить"]').trigger('click')
    await byText(w, 'Удалить пакет')!.trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${API}/3/archive`, {
      method: 'POST',
      body: { version: 1 },
    })
    expect(toastShow).toHaveBeenCalledWith('Пакет перенесён в архив')
  })

  it('on a stale version shows the message and reloads the list', async () => {
    apiFetch.mockRejectedValue({
      statusCode: 409,
      data: { data: { code: 'event_balance_package.stale' } },
    })
    const w = await render()
    await byText(w, 'Скрыть')!.trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('другой администратор')
    expect(refresh).toHaveBeenCalled()
  })

  it('shows the change history from the audit log and loads it only for that view', async () => {
    const w = await render()
    expect(apiFetch).not.toHaveBeenCalled()
    await byText(w, 'История изменений')!.trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${API}/history`, { query: { limit: 50 } })
    const entry = w.get('[data-history-row]').text()
    expect(entry).toContain('Параметры изменены')
    expect(entry).toContain('events_30')
    expect(entry).toContain('Цена: 130 Br → 120 Br')
    expect(entry).toContain('Root')
    expect(byText(w, 'К пакетам')).toBeDefined()
  })
})
