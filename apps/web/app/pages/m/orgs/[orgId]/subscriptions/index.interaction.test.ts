// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Subscriptions from './index.vue'

import { apiErrorMessage } from '~/utils/api-error'

const Host = defineComponent({
  render: () => h(Suspense, null, { default: () => h(Subscriptions) }),
})

const route = reactive({ params: { orgId: '30' }, fullPath: '/m/orgs/30/subscriptions' })
const fetchApi = vi.fn<(url: string) => Promise<unknown>>()
let enabled = true
let wrapper: VueWrapper | undefined

const NOW = new Date('2026-10-19T12:00:00Z')
const sub = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  organizationId: 30,
  planId: 1,
  status: 'active',
  totalSessions: 8,
  usedSessions: 3,
  purchasedAt: '2026-10-01T10:00:00Z',
  activatedAt: '2026-10-02T10:00:00Z',
  expiresAt: '2026-11-06T12:00:00Z',
  updatedAt: '2026-10-10T10:00:00Z',
  plan: { id: 1, name: '8 сессий' },
  pendingPayment: null,
  usage: [] as unknown[],
  ...over,
})
const usage = (id: number, startsAt: string, status = 'attended') => ({
  bookingId: id,
  status,
  eventTitle: `Игра ${id}`,
  startsAt,
})

function stubGlobals() {
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('$fetch', fetchApi)
  vi.stubGlobal('apiErrorMessage', apiErrorMessage)
  vi.stubGlobal('apiErrorCode', () => undefined)
  vi.stubGlobal('useFetch', async () => ({
    data: ref({ organization: { id: 30, subscriptionsEnabled: enabled } }),
    error: ref(null),
    pending: ref(false),
    refresh: vi.fn(),
  }))
}

async function mountPage(subscriptions: unknown[]) {
  fetchApi.mockResolvedValue({ subscriptions })
  wrapper = mount(Host, {
    global: {
      stubs: {
        VtMiniHeader: true,
        VtIcon: true,
        VtChip: { template: '<span data-chip><slot /></span>' },
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
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  enabled = true
  stubGlobals()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
  fetchApi.mockReset()
})

describe('player subscriptions screen (20.4.9, M-13)', () => {
  it('hero: остаток, шкала по занятиям, срок «До … · N дн.»', async () => {
    const page = await mountPage([sub(1)])
    const hero = page.get('.vt-card--hero')
    expect(hero.text()).toContain('8 сессий')
    expect(hero.text()).toContain('5')
    expect(hero.text()).toContain('осталось из 8')
    expect(hero.text()).toContain('6 ноября · 18 дн.')
    const meter = hero.get('[role="meter"]')
    expect(meter.attributes('aria-valuenow')).toBe('5')
    expect(meter.findAll('span')).toHaveLength(8)
  })

  it('ведёт на экран покупки, пока покупка разрешена', async () => {
    const page = await mountPage([sub(1)])
    expect(page.get('a[href="/m/orgs/30/subscriptions/buy"]').text()).toContain(
      'Купить новый абонемент',
    )
  })

  it('выключенные абонементы: кнопки покупки нет, остаток и история остаются', async () => {
    enabled = false
    const page = await mountPage([sub(1)])
    expect(page.find('a[href$="/subscriptions/buy"]').exists()).toBe(false)
    expect(page.text()).toContain('недоступны для покупки')
    expect(page.find('.vt-card--hero').exists()).toBe(true)
  })

  it('история: использованный и истёкший абонементы с периодом и статусом', async () => {
    const page = await mountPage([
      sub(1),
      sub(2, {
        status: 'active',
        usedSessions: 8,
        totalSessions: 4,
        plan: { id: 2, name: '4 сессии' },
      }),
    ])
    const history = page.get('[aria-labelledby="subscription-history-title"]')
    expect(history.text()).toContain('4 сессии')
    expect(history.text()).toContain('Использован')
  })

  it('последние списания: три новейших по всем абонементам, с отметкой «не пришёл»', async () => {
    const page = await mountPage([
      sub(1, {
        usage: [
          usage(1, '2026-10-05T10:00:00Z'),
          usage(2, '2026-10-12T10:00:00Z', 'no_show'),
          usage(3, '2026-10-14T10:00:00Z'),
          usage(4, '2026-10-16T10:00:00Z'),
        ],
      }),
    ])
    const rows = page.get('[aria-labelledby="subscription-usage-title"]').findAll('li')
    expect(rows.map((r) => r.text())).toEqual([
      expect.stringContaining('Игра 4'),
      expect.stringContaining('Игра 3'),
      expect.stringContaining('Игра 2'),
    ])
    expect(rows[2]!.text()).toContain('не пришёл')
    expect(rows[0]!.text()).toContain('−1')
  })

  it('ожидающий оплаты абонемент — отдельный блок с суммой', async () => {
    const page = await mountPage([
      sub(5, {
        status: 'pending',
        pendingPayment: { id: 9, amount: 11000, currency: 'BYN', method: 'cash' },
      }),
    ])
    const pending = page.get('[aria-labelledby="subscription-pending-title"]')
    expect(pending.text()).toContain('110,00 BYN')
    expect(pending.text()).toContain('наличными')
    expect(page.get('[data-empty]').text()).toContain('Активных абонементов нет')
  })
})
