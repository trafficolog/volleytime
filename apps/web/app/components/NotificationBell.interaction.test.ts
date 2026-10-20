// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, onMounted, ref, watch } from 'vue'

import NotificationBell from './NotificationBell.vue'

const fetchApi = vi.fn<(url: string, opts?: Record<string, unknown>) => Promise<unknown>>()

function mountBell() {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('onMounted', onMounted)
  vi.stubGlobal('$fetch', fetchApi)
  return mount(NotificationBell, {
    props: { orgId: 30 },
    global: {
      stubs: {
        VtIcon: { template: '<i />' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  fetchApi.mockReset()
})

describe('NotificationBell (20.4.9)', () => {
  it('ведёт на ленту группы и показывает число непрочитанных', async () => {
    fetchApi.mockResolvedValue({ unreadCount: 3 })
    const w = mountBell()
    await flushPromises()
    expect(fetchApi).toHaveBeenCalledWith('/api/notifications', {
      query: { organizationId: 30, limit: 1 },
    })
    expect(w.get('a').attributes('href')).toBe('/m/orgs/30/notifications')
    expect(w.get('a').attributes('aria-label')).toBe('Уведомления, новых: 3')
    expect(w.get('[data-bell-badge]').text()).toBe('3')
  })

  it('без непрочитанных отметки нет', async () => {
    fetchApi.mockResolvedValue({ unreadCount: 0 })
    const w = mountBell()
    await flushPromises()
    expect(w.find('[data-bell-badge]').exists()).toBe(false)
    expect(w.get('a').attributes('aria-label')).toBe('Уведомления')
  })

  it('большое число сжимается до 99+', async () => {
    fetchApi.mockResolvedValue({ unreadCount: 140 })
    const w = mountBell()
    await flushPromises()
    expect(w.get('[data-bell-badge]').text()).toBe('99+')
  })

  it('ошибка загрузки счётчика не ломает колокольчик', async () => {
    fetchApi.mockRejectedValue(new Error('offline'))
    const w = mountBell()
    await flushPromises()
    expect(w.find('[data-bell-badge]').exists()).toBe(false)
    expect(w.find('a').exists()).toBe(true)
  })
})
