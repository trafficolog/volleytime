// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Buy from './buy.vue'

import { apiErrorMessage } from '~/utils/api-error'

const Host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Buy) }) })

const route = reactive({ params: { orgId: '30' }, fullPath: '/m/orgs/30/subscriptions/buy' })
const fetchApi = vi.fn<(url: string, opts?: Record<string, unknown>) => Promise<unknown>>()
const navigate = vi.fn()
const toastShow = vi.fn()
const haptic = vi.fn()
let enabled = true
let wrapper: VueWrapper | undefined

const plan = (id: number, sessions: number, price: number, over: Record<string, unknown> = {}) => ({
  id,
  organizationId: 30,
  name: `${sessions} занятий`,
  totalSessions: sessions,
  validityDays: 30,
  price,
  currency: 'BYN',
  status: 'active',
  ...over,
})

function stubGlobals() {
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useTelegram', () => ({ haptic }))
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('$fetch', fetchApi)
  vi.stubGlobal('navigateTo', navigate)
  vi.stubGlobal('apiErrorMessage', apiErrorMessage)
  vi.stubGlobal('apiErrorCode', () => undefined)
  vi.stubGlobal('useFetch', async () => ({
    data: ref({ organization: { id: 30, subscriptionsEnabled: enabled } }),
    error: ref(null),
    pending: ref(false),
    refresh: vi.fn(),
  }))
}

async function mountPage(plans: unknown[]) {
  fetchApi.mockImplementation(async (url) => {
    if (url.endsWith('/plans')) return { plans }
    return undefined
  })
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
  return wrapper
}

beforeEach(() => {
  enabled = true
  stubGlobals()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  fetchApi.mockReset()
  navigate.mockReset()
  toastShow.mockReset()
  haptic.mockReset()
})

describe('player subscription purchase screen (20.4.9, M-13)', () => {
  it('показывает планы с ценой за занятие; по умолчанию выбран первый, оплата наличными', async () => {
    const page = await mountPage([plan(1, 4, 6000), plan(2, 8, 11000)])
    const plans = page.findAll('[role="radiogroup"][aria-label="План абонемента"] [role="radio"]')
    expect(plans).toHaveLength(2)
    expect(plans[0]!.attributes('aria-checked')).toBe('true')
    expect(plans[1]!.text()).toContain('13,75')
    const cta = page.get('button.vt-btn--primary')
    expect(cta.text()).toContain('Купить «4 сессии»')
  })

  it('оформляет выбранный план выбранным способом и возвращает на «Мои абонементы»', async () => {
    const page = await mountPage([plan(1, 4, 6000), plan(2, 8, 11000)])
    await page.findAll('[aria-label="План абонемента"] [role="radio"]')[1]!.trigger('click')
    await page.findAll('[aria-label="Способ оплаты"] [role="radio"]')[1]!.trigger('click')
    await page.get('button.vt-btn--primary').trigger('click')
    await flushPromises()
    expect(fetchApi).toHaveBeenLastCalledWith('/api/organizations/30/subscriptions', {
      method: 'POST',
      body: { planId: 2, method: 'transfer' },
    })
    expect(haptic).toHaveBeenCalledWith('success')
    expect(toastShow).toHaveBeenCalledWith('Заявка отправлена организатору')
    expect(navigate).toHaveBeenCalledWith('/m/orgs/30/subscriptions')
  })

  it('бесплатный план: без выбора способа оплаты, кнопка «Получить»', async () => {
    const page = await mountPage([plan(3, 1, 0)])
    expect(page.find('[aria-label="Способ оплаты"]').exists()).toBe(false)
    const cta = page.get('button.vt-btn--primary')
    expect(cta.text()).toContain('Получить')
    await cta.trigger('click')
    await flushPromises()
    expect(fetchApi).toHaveBeenLastCalledWith('/api/organizations/30/subscriptions', {
      method: 'POST',
      body: { planId: 3, method: 'cash' },
    })
    expect(toastShow).toHaveBeenCalledWith('Абонемент активирован')
  })

  it('ошибка оформления остаётся на экране и не уводит назад', async () => {
    const page = await mountPage([plan(1, 4, 6000)])
    fetchApi.mockRejectedValueOnce(new Error('nope'))
    await page.get('button.vt-btn--primary').trigger('click')
    await flushPromises()
    expect(page.get('[role="alert"]').text()).toContain('Не удалось оформить абонемент')
    expect(navigate).not.toHaveBeenCalled()
    expect(haptic).toHaveBeenCalledWith('error')
  })

  it('абонементы выключены в группе: покупки нет, планы не запрашиваются', async () => {
    enabled = false
    const page = await mountPage([plan(1, 4, 6000)])
    expect(page.text()).toContain('недоступны для покупки')
    expect(fetchApi).not.toHaveBeenCalled()
    expect(page.find('button.vt-btn--primary').exists()).toBe(false)
  })

  it('нет планов — пустое состояние', async () => {
    const page = await mountPage([])
    expect(page.get('[data-empty]').text()).toContain('Организатор пока не добавил планы')
  })
})
