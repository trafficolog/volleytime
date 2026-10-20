// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Notifications from './notifications.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import NotificationFeedItem from '~/components/NotificationFeedItem.vue'
import { apiErrorMessage } from '~/utils/api-error'

const Host = defineComponent({
  render: () => h(Suspense, null, { default: () => h(Notifications) }),
})

const route = reactive({ params: { orgId: '30' }, fullPath: '/m/orgs/30/notifications' })
const fetchApi = vi.fn<(url: string, opts?: Record<string, unknown>) => Promise<unknown>>()
let wrapper: VueWrapper | undefined

const FIXED_NOW = new Date('2026-10-19T12:00:00Z')

const note = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  type: 'reminder_2h',
  organizationId: 30,
  eventId: 100 + id,
  readAt: null,
  createdAt: '2026-10-19T09:00:00Z',
  payload: {
    template: 'reminder_2h',
    params: { eventTitle: `Игра ${id}`, eventDate: '19 октября, 20:00' },
  },
  ...over,
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
}

async function mountPage() {
  wrapper = mount(Host, {
    global: {
      components: { EmptyState, ErrorState, NotificationFeedItem },
      stubs: {
        VtMiniHeader: { template: '<header><slot name="right" /></header>' },
        VtIcon: { template: '<i />' },
        SkeletonList: { template: '<div data-skeleton />' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FIXED_NOW)
  stubGlobals()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
  fetchApi.mockReset()
})

describe('player notifications feed (20.4.9, M-13)', () => {
  it('запрашивает ленту своей группы и группирует по дням', async () => {
    fetchApi.mockResolvedValue({
      items: [
        note(3),
        note(2, { createdAt: '2026-10-18T09:00:00Z', readAt: '2026-10-18T10:00:00Z' }),
        note(1, { createdAt: '2026-10-01T09:00:00Z', readAt: '2026-10-01T10:00:00Z' }),
      ],
      nextCursor: null,
      unreadCount: 1,
    })
    const page = await mountPage()
    expect(fetchApi).toHaveBeenCalledWith(
      '/api/notifications',
      expect.objectContaining({ query: { organizationId: 30, cursor: undefined } }),
    )
    expect(page.findAll('section h2').map((h) => h.text())).toEqual(['Сегодня', 'Вчера', 'Ранее'])
    expect(page.findAll('[data-notification]')).toHaveLength(3)
    expect(page.findAll('[data-unread-dot]')).toHaveLength(1)
    expect(page.get('a[href="/m/orgs/30/events/103"]').text()).toContain('Через 2 часа · Игра 3')
  })

  it('«Прочитать всё» отмечает все уведомления группы и убирает кнопку', async () => {
    fetchApi.mockResolvedValueOnce({ items: [note(2), note(1)], nextCursor: null, unreadCount: 2 })
    fetchApi.mockResolvedValueOnce({ updated: 2 })
    const page = await mountPage()
    await page.get('header button').trigger('click')
    await flushPromises()
    expect(fetchApi).toHaveBeenLastCalledWith('/api/notifications/read', {
      method: 'POST',
      body: { all: true, organizationId: 30 },
    })
    expect(page.findAll('[data-unread-dot]')).toHaveLength(0)
    expect(page.find('header button').exists()).toBe(false)
  })

  it('открытие карточки отмечает только её прочитанной', async () => {
    fetchApi.mockResolvedValueOnce({ items: [note(2), note(1)], nextCursor: null, unreadCount: 2 })
    fetchApi.mockResolvedValueOnce({ updated: 1 })
    const page = await mountPage()
    await page.get('[data-notification]').trigger('click')
    expect(fetchApi).toHaveBeenLastCalledWith('/api/notifications/read', {
      method: 'POST',
      body: { ids: [2] },
    })
    expect(page.findAll('[data-unread-dot]')).toHaveLength(1)
  })

  it('«Показать ещё» догружает следующую страницу по курсору без дублей', async () => {
    fetchApi.mockResolvedValueOnce({ items: [note(2)], nextCursor: '2', unreadCount: 2 })
    fetchApi.mockResolvedValueOnce({ items: [note(2), note(1)], nextCursor: null, unreadCount: 2 })
    const page = await mountPage()
    await page.get('main button').trigger('click')
    await flushPromises()
    expect(fetchApi).toHaveBeenLastCalledWith(
      '/api/notifications',
      expect.objectContaining({ query: { organizationId: 30, cursor: '2' } }),
    )
    expect(page.findAll('[data-notification]')).toHaveLength(2)
    expect(page.text()).not.toContain('Показать ещё')
  })

  it('пустая лента — «Всё прочитано», без кнопки «Прочитать всё»', async () => {
    fetchApi.mockResolvedValue({ items: [], nextCursor: null, unreadCount: 0 })
    const page = await mountPage()
    expect(page.text()).toContain('Всё прочитано')
    expect(page.find('header button').exists()).toBe(false)
  })

  it('ошибка загрузки — состояние ошибки с повтором', async () => {
    fetchApi.mockRejectedValueOnce(new Error('boom'))
    const page = await mountPage()
    expect(page.text()).toContain('Не удалось загрузить уведомления')
    fetchApi.mockResolvedValueOnce({ items: [note(1)], nextCursor: null, unreadCount: 1 })
    await page.findComponent(ErrorState).vm.$emit('retry')
    await flushPromises()
    expect(page.findAll('[data-notification]')).toHaveLength(1)
  })
})
