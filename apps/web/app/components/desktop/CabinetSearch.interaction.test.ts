// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CabinetSearch from './CabinetSearch.vue'

import type { CabinetSearchResponse } from '~/utils/cabinet-search'

const empty = { items: [], more: false }
const apiFetch = vi.fn()
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('apiErrorMessage', (_e: unknown, fallback: string) => fallback)

const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  VtIcon: { template: '<svg />' },
}

function mountSearch(orgId = 30) {
  return mount(CabinetSearch, {
    props: { orgId, timeZone: 'Europe/Minsk' },
    global: { stubs },
    attachTo: document.body,
  })
}

const result = (over: Partial<CabinetSearchResponse> = {}): CabinetSearchResponse => ({
  query: 'ол',
  searched: true,
  players: {
    more: false,
    items: [
      {
        memberId: 5,
        userId: 9,
        name: 'Ольга Волкова',
        telegramUsername: 'olga_v',
        image: null,
        role: 'player',
        status: 'active',
      },
    ],
  },
  events: {
    more: false,
    items: [
      {
        id: 71,
        title: 'Пятничная игра',
        startsAt: '2027-10-01T12:00:00.000Z',
        status: 'published',
        venueName: null,
      },
    ],
  },
  payments: empty,
  ...over,
})

async function type(wrapper: ReturnType<typeof mountSearch>, value: string) {
  await wrapper.get('input').setValue(value)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers()
  apiFetch.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('cabinet search (20.5.2)', () => {
  it('does not call the API for fewer than two characters and says why', async () => {
    const wrapper = mountSearch()
    await type(wrapper, 'о')
    expect(apiFetch).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('минимум 2 символа')
  })

  it('debounces typing into one request and groups results by type', async () => {
    apiFetch.mockResolvedValue(result())
    const wrapper = mountSearch()
    const input = wrapper.get('input')
    await input.setValue('ол')
    await input.setValue('оль')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/search', {
      query: { q: 'оль' },
      signal: expect.any(AbortSignal),
    })
    const headings = wrapper.findAll('[role="group"]').map((g) => g.get('p').text())
    expect(headings).toEqual(['Игроки', 'События'])
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual(['/app/orgs/30/members', '/app/orgs/30/events/71'])
  })

  it('shows an empty state and an error state', async () => {
    apiFetch.mockResolvedValueOnce(result({ players: empty, events: empty }))
    const wrapper = mountSearch()
    await type(wrapper, 'zz')
    expect(wrapper.text()).toContain('Ничего не найдено')
    apiFetch.mockRejectedValueOnce(new Error('boom'))
    await type(wrapper, 'zzz')
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось выполнить поиск')
  })

  it('ignores a stale response that arrives after a newer one', async () => {
    let resolveFirst: (v: CabinetSearchResponse) => void = () => undefined
    apiFetch.mockImplementationOnce(
      () => new Promise<CabinetSearchResponse>((r) => (resolveFirst = r)),
    )
    apiFetch.mockResolvedValueOnce(result({ players: empty, events: empty }))
    const wrapper = mountSearch()
    await type(wrapper, 'ол')
    await type(wrapper, 'оль')
    expect(wrapper.text()).toContain('Ничего не найдено')
    resolveFirst(result())
    await flushPromises()
    expect(wrapper.text()).toContain('Ничего не найдено')
    expect(wrapper.findAll('a')).toHaveLength(0)
  })

  it('does not render a payments section when the API returns none for the role', async () => {
    apiFetch.mockResolvedValue(result({ payments: null }))
    const wrapper = mountSearch()
    await type(wrapper, 'ол')
    expect(wrapper.text()).not.toContain('Платежи')
  })

  it('closes on Escape and focuses on Ctrl+K', async () => {
    apiFetch.mockResolvedValue(result())
    const wrapper = mountSearch()
    await type(wrapper, 'ол')
    expect(wrapper.find('#cabinet-search-panel').exists()).toBe(true)
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('#cabinet-search-panel').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(document.activeElement).toBe(wrapper.get('input').element)
  })

  it('keeps one status live region mounted and reports the count', async () => {
    apiFetch.mockResolvedValue(result())
    const wrapper = mountSearch()
    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toBe('')
    await type(wrapper, 'ол')
    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toBe('Найдено: 2')
    apiFetch.mockResolvedValue(result({ players: empty, events: empty }))
    await type(wrapper, 'зз')
    expect(wrapper.get('[role="status"]').text()).toBe('Ничего не найдено')
  })

  it('has no aria-expanded on the search input', () => {
    expect(mountSearch().get('input').attributes('aria-expanded')).toBeUndefined()
  })

  it('Escape returns focus to the input and does not reach outer handlers', async () => {
    apiFetch.mockResolvedValue(result())
    const outer = vi.fn()
    const host = document.createElement('div')
    host.addEventListener('keydown', outer)
    document.body.appendChild(host)
    const wrapper = mount(CabinetSearch, {
      props: { orgId: 30, timeZone: 'Europe/Minsk' },
      global: { stubs },
      attachTo: host,
    })
    await type(wrapper, 'ол')
    await wrapper.get('a').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('#cabinet-search-panel').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('input').element)
    expect(outer).not.toHaveBeenCalled()
  })

  it('closes when focus moves outside the search', async () => {
    apiFetch.mockResolvedValue(result())
    const wrapper = mountSearch()
    await type(wrapper, 'ол')
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    await wrapper.trigger('focusout', { relatedTarget: wrapper.get('a').element })
    expect(wrapper.find('#cabinet-search-panel').exists()).toBe(true)
    await wrapper.trigger('focusout', { relatedTarget: outside })
    expect(wrapper.find('#cabinet-search-panel').exists()).toBe(false)
  })

  it('Ctrl+K does not steal focus from another editable field', () => {
    mountSearch()
    const other = document.createElement('textarea')
    document.body.appendChild(other)
    other.focus()
    other.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    expect(document.activeElement).toBe(other)
  })

  it('typing during an in-flight request shows no error and keeps "Ищем…"', async () => {
    apiFetch.mockImplementation(
      (_u: string, o: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          o.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )
    const wrapper = mountSearch()
    await type(wrapper, 'ол')
    expect(apiFetch).toHaveBeenCalledTimes(1)
    await wrapper.get('input').setValue('оль')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('#cabinet-search-panel').text()).toContain('Ищем…')
    // «Ищем…» не озвучивается: live-область объявляет только результат
    expect(wrapper.get('[role="status"]').text()).toBe('')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('#cabinet-search-panel').text()).toContain('Ищем…')
  })

  it('aborts the in-flight request when the query changes or the component unmounts', async () => {
    const signals: AbortSignal[] = []
    apiFetch.mockImplementation((_u: string, o: { signal: AbortSignal }) => {
      signals.push(o.signal)
      return new Promise(() => undefined)
    })
    const wrapper = mountSearch()
    await type(wrapper, 'ол')
    await wrapper.get('input').setValue('оль')
    expect(signals[0]!.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(300)
    expect(signals).toHaveLength(2)
    expect(signals[1]!.aborted).toBe(false)
    wrapper.unmount()
    expect(signals[1]!.aborted).toBe(true)
  })
})
