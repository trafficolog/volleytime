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

import Grant from './billing-grant.vue'
import { stubPlatformStaff } from '~/test-support/platform-staff'

const route = reactive<{ query: Record<string, string> }>({ query: {} })
const apiFetch = vi.fn()
const navigate = vi.fn()
let wrapper: VueWrapper | undefined
let orgDetail: unknown

const ORG = {
  id: 3,
  name: 'VolleyTime Минск',
  deletedAt: null,
  stats: { balance: 32, lowBalance: false },
}
const SEARCH = {
  items: [
    { id: 3, name: 'VolleyTime Минск', balance: 32 },
    { id: 4, name: 'СОК Витебск', balance: 1 },
  ],
}
const RESULT = {
  entryId: 5,
  organization: { id: 3, name: 'VolleyTime Минск' },
  delta: 10,
  balanceAfter: 42,
  category: 'promo',
  comment: 'Промо',
  createdAt: '2026-11-19T09:02:00.000Z',
  replayed: false,
}

beforeEach(() => {
  route.query = {}
  orgDetail = ORG
  navigate.mockReset()
  apiFetch.mockReset().mockResolvedValue(RESULT)
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useHead', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useFetch', async (url: unknown) => {
    const target = typeof url === 'function' ? (url as () => string)() : String(url)
    const isSearch = target === '/api/platform/organizations'
    return {
      data: ref(isSearch ? SEARCH : orgDetail),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn().mockResolvedValue(undefined),
    }
  })
  vi.stubGlobal('navigateTo', navigate)
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
  stubPlatformStaff('owner')
  vi.stubGlobal('$fetch', apiFetch)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Grant) }) }),
    {
      attachTo: document.body,
      global: { stubs: { VtIcon: true, NuxtLink: { template: '<a><slot /></a>', props: ['to'] } } },
    },
  )
  await flushPromises()
  return wrapper
}

const byText = (w: VueWrapper, text: string) =>
  w.findAll('button').find((b) => b.text().replace(/\s+/g, ' ').trim() === text)

describe('root grant balance (R-03, 22.2.2)', () => {
  it('without an organization offers a searchable list that links to the form', async () => {
    orgDetail = null
    const w = await render()
    expect(w.text()).toContain('Выберите организацию')
    expect(w.text()).toContain('СОК Витебск')
    expect(w.text()).toContain('32 события')
    expect(w.find('form button[type="submit"]').exists()).toBe(false)
  })

  describe('with an organization', () => {
    beforeEach(() => {
      route.query = { org: '3' }
    })

    it('shows the current balance and the balance after the grant (D-10 wording)', async () => {
      const w = await render()
      expect(w.text()).toContain('текущий баланс: 32 события')
      expect(w.text()).toContain('42 события')
      await byText(w, '+30')!.trigger('click')
      expect((w.get('input[name="units"]').element as HTMLInputElement).value).toBe('30')
      expect(w.text()).toContain('62 события')
      expect(w.text()).not.toMatch(/credit/i)
    })

    it('does not grant without a reason and does not call the API', async () => {
      const w = await render()
      await w.get('form').trigger('submit')
      expect(w.text()).toContain('без неё начисление невозможно')
      await w.get('textarea[name="comment"]').setValue('  ab ')
      await w.get('form').trigger('submit')
      expect(w.text()).toContain('без неё начисление невозможно')
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('rejects out-of-bounds or fractional units before any request', async () => {
      const w = await render()
      await w.get('textarea[name="comment"]').setValue('Промо')
      for (const units of ['0', '1001', '2.5', '']) {
        await w.get('input[name="units"]').setValue(units)
        await w.get('form').trigger('submit')
        expect(w.text(), units).toContain('Целое число событий от 1 до 1000')
      }
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('posts units, category, trimmed reason and an idempotency key, then shows the result', async () => {
      const w = await render()
      await byText(w, 'Компенсация')!.trigger('click')
      await w.get('textarea[name="comment"]').setValue('  Баг #142  ')
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(apiFetch).toHaveBeenCalledTimes(1)
      const [url, opts] = apiFetch.mock.calls[0] as [
        string,
        { method: string; body: Record<string, unknown> },
      ]
      expect(url).toBe('/api/platform/organizations/3/event-balance-grants')
      expect(opts.method).toBe('POST')
      expect(opts.body).toMatchObject({ units: 10, category: 'compensation', comment: 'Баг #142' })
      expect(String(opts.body.idempotencyKey)).toMatch(/^[0-9a-f-]{36}$/)
      expect(w.get('[role="status"]').text()).toContain('Баланс выдан')
      expect(w.text()).toContain('баланс теперь 42 события')
    })

    it('ignores a second submit while the first is in flight', async () => {
      let release: (v: unknown) => void = () => undefined
      apiFetch.mockImplementation(() => new Promise((r) => (release = r)))
      const w = await render()
      await w.get('textarea[name="comment"]').setValue('Промо')
      await w.get('form').trigger('submit')
      await w.get('form').trigger('submit')
      expect(apiFetch).toHaveBeenCalledTimes(1)
      release(RESULT)
      await flushPromises()
    })

    it('retries a failed submit with the same key and starts a new attempt after an edit', async () => {
      apiFetch.mockRejectedValue({ statusCode: 500, data: { code: 'internal' } })
      const w = await render()
      await w.get('textarea[name="comment"]').setValue('Промо')
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(w.get('[role="alert"]').text()).toContain('Не удалось выдать баланс')
      await w.get('form').trigger('submit')
      await flushPromises()
      const key = (i: number) =>
        (apiFetch.mock.calls[i]![1] as { body: { idempotencyKey: string } }).body.idempotencyKey
      expect(key(1)).toBe(key(0))
      await w.get('input[name="units"]').setValue('11')
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(key(2)).not.toBe(key(0))
    })

    it('blocks a deleted organization', async () => {
      orgDetail = { ...ORG, deletedAt: '2026-11-01T00:00:00.000Z' }
      const w = await render()
      expect(w.text()).toContain('начислять баланс нельзя')
      expect(w.get('button[type="submit"]').attributes('disabled')).toBeDefined()
      await w.get('form').trigger('submit')
      expect(apiFetch).not.toHaveBeenCalled()
    })
  })
})

describe('root grant balance: кнопка выдачи по роли (29.3.1, R-15)', () => {
  beforeEach(() => {
    route.query = { org: '3' }
  })
  const submit = (w: VueWrapper) => w.find('form button[type="submit"]')

  it.each(['owner', 'admin', 'finance'] as const)('%s видит «Выдать»', async (role) => {
    stubPlatformStaff(role)
    expect(submit(await render()).exists()).toBe(true)
  })

  it.each(['analyst', 'support', 'pending', 'error'] as const)(
    '%s не видит «Выдать» и не отправляет форму',
    async (state) => {
      stubPlatformStaff(state)
      const w = await render()
      expect(submit(w).exists()).toBe(false)
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(apiFetch).not.toHaveBeenCalled()
    },
  )
})
