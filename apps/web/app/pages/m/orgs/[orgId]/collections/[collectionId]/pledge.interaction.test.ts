// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Pledge from './pledge.vue'

import { apiErrorMessage } from '~/utils/api-error'

const Host = defineComponent({
  render: () => h(Suspense, null, { default: () => h(Pledge) }),
})

const route = reactive({
  params: { orgId: '30', collectionId: '4' },
  fullPath: '/m/orgs/30/collections/4/pledge',
})
const fetchApi =
  vi.fn<(url: string, options?: { method: string; body: unknown }) => Promise<unknown>>()
const navigate = vi.fn()
const toastShow = vi.fn()
const refreshOrg = vi.fn()
let collectionsEnabled = true
let errorCode: string | undefined
let wrapper: VueWrapper | undefined

const collection = (over: Record<string, unknown> = {}) => ({
  id: 4,
  title: 'Новый комплект мячей',
  description: null,
  icon: 'ball',
  targetAmount: 25000,
  currency: 'BYN',
  status: 'active',
  deadlineAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  closedAt: null,
  createdBy: { id: 5, name: 'Организатор' },
  collected: 0,
  pledged: 0,
  contributors: 0,
  my: { paid: 0, pending: null },
  ...over,
})

function stubGlobals() {
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('$fetch', fetchApi)
  vi.stubGlobal('navigateTo', navigate)
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
  vi.stubGlobal('useTelegram', () => ({ haptic: vi.fn() }))
  vi.stubGlobal('apiErrorMessage', apiErrorMessage)
  vi.stubGlobal('apiErrorCode', () => errorCode)
  vi.stubGlobal('useFetch', async () => ({
    data: ref({ organization: { id: 30 }, capabilities: { collections: collectionsEnabled } }),
    error: ref(null),
    refresh: refreshOrg,
  }))
}

async function mountPage(initial: unknown = { collection: collection() }) {
  fetchApi.mockImplementation(async (_url, options) =>
    options?.method === 'POST' ? { contribution: { id: 11 }, replaced: false } : initial,
  )
  wrapper = mount(Host, {
    global: {
      stubs: {
        VtMiniHeader: { props: ['title', 'sub'], template: '<h1>{{ title }}|{{ sub }}</h1>' },
        VtIcon: true,
        SkeletonList: true,
        ErrorState: { props: ['message'], template: '<div data-error>{{ message }}</div>' },
        PlayerAccessNotice: true,
        EmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

const apiError = (code: string) => Object.assign(new Error(code), { data: { data: { code } } })
const submitButton = (page: VueWrapper) => page.get('button.vt-btn--primary')
const posts = () => fetchApi.mock.calls.filter(([, options]) => options?.method === 'POST')

beforeEach(() => {
  stubGlobals()
  collectionsEnabled = true
  errorCode = undefined
  fetchApi.mockReset()
  navigate.mockReset()
  toastShow.mockReset()
  refreshOrg.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('player pledge screen (21.1.6)', () => {
  it('sends the chosen preset in minor units as a cash pledge and returns to the collection', async () => {
    const page = await mountPage()
    expect(submitButton(page).text()).toContain('Обещать взнос')
    expect(submitButton(page).text()).toContain('15,00 BYN')
    const preset = page
      .findAll('[aria-label="Готовые суммы"] button')
      .find((b) => b.text().startsWith('25 '))!
    await preset.trigger('click')
    expect(preset.attributes('aria-pressed')).toBe('true')
    await submitButton(page).trigger('click')
    await flushPromises()
    expect(posts()).toEqual([
      [
        '/api/organizations/30/collections/4/contributions',
        { method: 'POST', body: { amount: 2500, method: 'cash' } },
      ],
    ])
    expect(toastShow).toHaveBeenCalledWith('Обещано 25,00 BYN · ждём подтверждения')
    expect(navigate).toHaveBeenCalledWith('/m/orgs/30/collections/4')
  })

  it('accepts a custom amount with a comma and a transfer method', async () => {
    const page = await mountPage()
    await page.get('input').setValue('12,5')
    await page.get('[role="radio"]:nth-child(2)').trigger('click')
    await submitButton(page).trigger('click')
    await flushPromises()
    expect(posts()[0]![1]!.body).toEqual({ amount: 1250, method: 'transfer' })
  })

  it('blocks an invalid amount without sending anything', async () => {
    const page = await mountPage()
    for (const bad of ['', '0', '1,234', 'abc', '100000,5']) {
      await page.get('input').setValue(bad)
      expect(submitButton(page).attributes('disabled')).toBeDefined()
    }
    await page.get('input').setValue('1,234')
    expect(page.get('#pledge-amount-hint').attributes('role')).toBe('alert')
    expect(posts()).toHaveLength(0)
  })

  it('says a new pledge replaces the waiting one and prefills it', async () => {
    const page = await mountPage({
      collection: collection({
        my: { paid: 0, pending: { id: 9, amount: 1750, method: 'transfer' } },
      }),
    })
    const notice = page.get('[data-testid="replace-notice"]')
    expect(notice.text()).toContain('У вас уже есть обещание на 17,50 BYN (переводом)')
    expect(notice.text()).toContain('Новый взнос заменит его')
    expect(notice.text()).toContain('организатор получит новую')
    expect((page.get('input').element as HTMLInputElement).value).toBe('17,5')
    expect(page.get('[role="radio"][aria-checked="true"]').text()).toContain('переводом')
    expect(submitButton(page).text()).toContain('Заменить обещание')
  })

  it('confirms in the toast that the previous pledge was replaced', async () => {
    const page = await mountPage({
      collection: collection({ my: { paid: 0, pending: { id: 9, amount: 1500, method: 'cash' } } }),
    })
    fetchApi.mockImplementation(async (_url, options) =>
      options?.method === 'POST' ? { contribution: { id: 12 }, replaced: true } : {},
    )
    await page.get('input').setValue('20')
    await submitButton(page).trigger('click')
    await flushPromises()
    expect(toastShow).toHaveBeenCalledWith('Обещание заменено на 20,00 BYN · ждём подтверждения')
  })

  it('does not double submit while the request is in flight', async () => {
    const page = await mountPage()
    let release: (value: unknown) => void = () => undefined
    fetchApi.mockImplementation((_url, options) =>
      options?.method === 'POST'
        ? new Promise((resolve) => (release = resolve))
        : Promise.resolve({ collection: collection() }),
    )
    await submitButton(page).trigger('click')
    await submitButton(page).trigger('click')
    expect(posts()).toHaveLength(1)
    release({ contribution: { id: 11 }, replaced: false })
    await flushPromises()
  })

  it('disables pledging with a notice while the collections flag is off', async () => {
    collectionsEnabled = false
    const page = await mountPage()
    expect(page.get('[role="status"]').text()).toContain('Приём взносов сейчас приостановлен')
    expect(submitButton(page).attributes('disabled')).toBeDefined()
    await submitButton(page).trigger('click')
    expect(posts()).toHaveLength(0)
  })

  it('handles collection.disabled from the server: message, no navigation, form locked', async () => {
    const page = await mountPage()
    errorCode = 'collection.disabled'
    fetchApi.mockImplementation(async (_url, options) => {
      if (options?.method === 'POST') throw apiError('collection.disabled')
      return { collection: collection() }
    })
    await submitButton(page).trigger('click')
    await flushPromises()
    expect(page.get('[role="alert"]').text()).toContain('Сборы пока недоступны')
    expect(navigate).not.toHaveBeenCalled()
    expect(refreshOrg).toHaveBeenCalled()
    expect(submitButton(page).attributes('disabled')).toBeDefined()
  })

  it('shows the closed state after collection.not_active', async () => {
    const page = await mountPage()
    errorCode = 'collection.not_active'
    let posted = false
    fetchApi.mockImplementation(async (_url, options) => {
      if (options?.method === 'POST') {
        posted = true
        throw new Error('409')
      }
      return { collection: collection(posted ? { status: 'completed' } : {}) }
    })
    await submitButton(page).trigger('click')
    await flushPromises()
    expect(page.text()).toContain('Сбор закрыт, новые взносы не принимаются')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('shows not found for an unknown collection', async () => {
    errorCode = 'collection.not_found'
    fetchApi.mockRejectedValue(new Error('404'))
    wrapper = mount(Host, {
      global: {
        stubs: {
          VtMiniHeader: true,
          VtIcon: true,
          SkeletonList: true,
          ErrorState: true,
          PlayerAccessNotice: true,
          EmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' },
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    })
    await flushPromises()
    expect(wrapper.get('[data-empty]').text()).toBe('Сбор не найден')
  })
})
