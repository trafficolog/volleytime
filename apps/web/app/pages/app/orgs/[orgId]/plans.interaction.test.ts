// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, Suspense, watch } from 'vue'

import Plans from './plans.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'

const route = reactive({ params: { orgId: '30' }, path: '/app/orgs/30/plans' })
const apiFetch = vi.fn()
let wrapper: VueWrapper | undefined
let subscriptionsEnabled: boolean | null = true

function plan(id: number, name: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: 30,
    name,
    description: null,
    totalSessions: 8,
    validityDays: 45,
    price: 11000,
    currency: 'BYN',
    status: 'active',
    ...over,
  }
}

beforeEach(() => {
  subscriptionsEnabled = true
  apiFetch.mockReset().mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (url === '/api/organizations/30/plans' && !opts?.method) {
      return { plans: [plan(1, '8 занятий'), plan(2, 'Пробный', { totalSessions: 1, price: 0 })] }
    }
    return {}
  })
  vi.stubGlobal('window', Object.assign(window, { confirm: () => true }))
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useFetch', async () => ({
    data: ref(
      subscriptionsEnabled === null
        ? null
        : {
            organization: {
              id: 30,
              defaultCurrency: 'BYN',
              subscriptionsEnabled,
            },
          },
    ),
    error: ref(subscriptionsEnabled === null ? new Error('fail') : null),
  }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
  vi.stubGlobal('$fetch', apiFetch)
  vi.stubGlobal('apiErrorMessage', (e: { message?: string }, fallback: string) =>
    e.message ? e.message : fallback,
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Plans) }) }),
    {
      attachTo: document.body,
      global: { components: { EmptyState, ErrorState, SkeletonList }, stubs: { Icon: true } },
    },
  )
  await flushPromises()
  return wrapper
}

const byText = (w: VueWrapper, text: string) =>
  w.findAll('button').find((b) => b.text().trim() === text)

describe('desktop plans (W-09)', () => {
  it('shows plan cards with sessions, price, per-session price and sale status', async () => {
    const w = await render()
    const cards = w.findAll('.vt-desktop-plans__card')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('8 занятий')
    expect(cards[0]!.text()).toContain('13,75 BYN/занятие · 45 дн.')
    expect(cards[0]!.text()).toContain('в продаже')
    expect(cards[1]!.text()).toContain('Бесплатно')
  })

  it('previews the card live while the new plan form is filled in, then creates the plan', async () => {
    const w = await render()
    await byText(w, 'Новый план')!.trigger('click')
    expect(w.find('h2').text()).toBe('Новый план')
    await w.find('#desktop-plan-name').setValue('12 занятий')
    await w.find('#desktop-plan-sessions').setValue('12')
    await w.find('#desktop-plan-days').setValue('60')
    await w.find('#desktop-plan-price').setValue('150')
    const preview = w.find('[data-testid="plan-preview"]')
    expect(preview.text()).toContain('12')
    expect(preview.text()).toContain('12 занятий')
    expect(preview.text()).toContain('12,50 BYN/занятие · 60 дн.')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/plans', {
      method: 'POST',
      body: { name: '12 занятий', totalSessions: 12, validityDays: 60, price: 15000 },
    })
    expect(w.find('form').exists()).toBe(false)
  })

  it('edits and archives an active plan', async () => {
    const w = await render()
    await byText(w, 'Изменить')!.trigger('click')
    expect((w.find('#desktop-plan-name').element as HTMLInputElement).value).toBe('8 занятий')
    expect((w.find('#desktop-plan-price').element as HTMLInputElement).value).toBe('110.00')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/plans/1', {
      method: 'PATCH',
      body: { name: '8 занятий', totalSessions: 8, validityDays: 45, price: 11000 },
    })
    await byText(w, 'Убрать из продажи')!.trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/plans/1/archive', {
      method: 'POST',
    })
  })

  it('keeps existing plans read-only and explains it when subscriptions are off', async () => {
    subscriptionsEnabled = false
    const w = await render()
    expect(w.text()).toContain('Абонементы выключены в настройках группы')
    expect(w.text()).toContain('оплачивать ими новые записи')
    expect(w.findAll('.vt-desktop-plans__card')).toHaveLength(2)
    expect(byText(w, 'Новый план')).toBeUndefined()
    expect(byText(w, 'Изменить')).toBeUndefined()
    expect(byText(w, 'Убрать из продажи')).toBeUndefined()
  })

  it('blocks changes when the group settings could not be read', async () => {
    subscriptionsEnabled = null
    const w = await render()
    expect(w.text()).toContain('Не удалось проверить настройки группы')
    expect(byText(w, 'Новый план')).toBeUndefined()
  })
})
