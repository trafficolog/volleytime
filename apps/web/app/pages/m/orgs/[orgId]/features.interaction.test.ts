// @vitest-environment happy-dom
import { defaultPlayerFeatures, type PlayerFeatures } from '@volley-time/shared'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref, Suspense } from 'vue'

import Features from './features.vue'

import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import VtSegment from '~/components/vt/Segment.vue'
import VtToggle from '~/components/vt/Toggle.vue'

let wrapper: VueWrapper | undefined
const fetchMock = vi.fn()
const refreshData = vi.fn(async () => undefined)
let server: PlayerFeatures = defaultPlayerFeatures()

function stubPage(initial: PlayerFeatures = defaultPlayerFeatures(), loadFails = false) {
  fetchMock.mockReset()
  refreshData.mockClear()
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => ({ params: { orgId: '30' } }))
  vi.stubGlobal('useTelegram', () => ({ haptic: vi.fn() }))
  vi.stubGlobal('apiErrorMessage', (_e: unknown, fallback = 'Ошибка') => fallback)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('refreshNuxtData', refreshData)
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useFetch', async () => ({
    data: ref(loadFails ? null : { features: initial }),
    error: ref(loadFails ? new Error('boom') : null),
    pending: ref(false),
    refresh: vi.fn(),
  }))
  // PATCH возвращает применённые флаги
  server = { ...initial }
  fetchMock.mockImplementation(async (_url: string, opts: { body: Partial<PlayerFeatures> }) => {
    server = { ...server, ...opts.body }
    return { features: server }
  })
}

async function render() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Features) }) })
  wrapper = mount(host, {
    global: {
      components: { ErrorState, SkeletonList, VtSegment, VtToggle },
      stubs: {
        VtMiniHeader: { template: '<header />' },
        VtIcon: { template: '<span />' },
        VtChip: { template: '<span><slot /></span>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('Mini App «Что показывать» (23.2.3, M-12)', () => {
  it('shows eight switches and the always-on schedule row', async () => {
    stubPage()
    const page = await render()
    expect(page.findAll('[data-testid="feature-row"]')).toHaveLength(8)
    expect(page.findAll('[role="switch"]')).toHaveLength(8)
    expect(page.get('[data-testid="feature-always"]').text()).toContain(
      'Расписание и запись — всегда',
    )
  })

  it('every switch has an accessible name from its visible label', async () => {
    stubPage()
    const page = await render()
    const first = page.get('[data-testid="feature-toggle-cal"]')
    const labelId = first.attributes('aria-labelledby')!
    expect(page.get(`#${labelId}`).text()).toBe('Календарь')
  })

  it('saves a toggle immediately via PATCH and refreshes shared state', async () => {
    stubPage()
    const page = await render()
    await page.get('[data-testid="feature-toggle-mvp"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/me/features', {
      method: 'PATCH',
      body: { mvp: false },
    })
    expect(refreshData).toHaveBeenCalledWith('me-features')
    expect(page.get('[data-testid="feature-toggle-mvp"]').attributes('aria-checked')).toBe('false')
  })

  it('«Только игры» switches everything off, «Всё» switches it back on', async () => {
    stubPage()
    const page = await render()
    const radios = page.findAll('[role="radio"]')
    expect(radios.map((r) => r.text())).toEqual(['Только игры', 'Всё', 'Своё'])
    expect(radios[1]!.attributes('aria-checked')).toBe('true')
    await radios[0]!.trigger('click')
    await flushPromises()
    const body = fetchMock.mock.calls[0]![1].body as PlayerFeatures
    expect(Object.keys(body)).toHaveLength(8)
    expect(Object.values(body).every((v) => v === false)).toBe(true)
    expect(
      page.findAll('[role="switch"]').every((s) => s.attributes('aria-checked') === 'false'),
    ).toBe(true)
    expect(page.findAll('[role="radio"]')[0]!.attributes('aria-checked')).toBe('true')
    await page.findAll('[role="radio"]')[1]!.trigger('click')
    await flushPromises()
    expect(Object.values(fetchMock.mock.calls[1]![1].body).every((v) => v === true)).toBe(true)
  })

  it('picks «Своё» for a mixed set and does not send anything for the «Своё» tap', async () => {
    stubPage({ ...defaultPlayerFeatures(), coach: false })
    const page = await render()
    expect(page.findAll('[role="radio"]')[2]!.attributes('aria-checked')).toBe('true')
    await page.findAll('[role="radio"]')[2]!.trigger('click')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rolls the switch back and says so when saving fails', async () => {
    stubPage()
    fetchMock.mockRejectedValue(new Error('offline'))
    const page = await render()
    await page.get('[data-testid="feature-toggle-cal"]').trigger('click')
    await flushPromises()
    expect(page.get('[data-testid="feature-toggle-cal"]').attributes('aria-checked')).toBe('true')
    expect(page.get('[role="alert"]').text()).toContain('Не удалось сохранить')
  })

  it('keeps switches enabled during a save and applies a second tap after the first', async () => {
    stubPage()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    fetchMock.mockImplementationOnce(
      async (_u: string, opts: { body: Partial<PlayerFeatures> }) => {
        await gate
        server = { ...server, ...opts.body }
        return { features: server }
      },
    )
    const page = await render()
    await page.get('[data-testid="feature-toggle-cal"]').trigger('click')
    // PATCH ещё в полёте: переключатель не заблокирован и остаётся доступным
    expect(page.get('[data-testid="feature-toggle-coach"]').attributes('disabled')).toBeUndefined()
    await page.get('[data-testid="feature-toggle-coach"]').trigger('click')
    await page.get('[data-testid="feature-toggle-mvp"]').trigger('click')
    await page.get('[data-testid="feature-toggle-mvp"]').trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    release()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]![1].body).toEqual({ cal: false })
    // следующий PATCH объединяет нажатия: последнее значение флага побеждает
    expect(fetchMock.mock.calls[1]![1].body).toEqual({ coach: false, mvp: true })
    const state = (f: string) =>
      page.get(`[data-testid="feature-toggle-${f}"]`).attributes('aria-checked')
    expect([state('cal'), state('coach'), state('mvp')]).toEqual(['false', 'false', 'true'])
  })

  it('applies a preset tapped while a save is in flight', async () => {
    stubPage()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    fetchMock.mockImplementationOnce(
      async (_u: string, opts: { body: Partial<PlayerFeatures> }) => {
        await gate
        server = { ...server, ...opts.body }
        return { features: server }
      },
    )
    const page = await render()
    await page.get('[data-testid="feature-toggle-cal"]').trigger('click')
    await page.findAll('[role="radio"]')[0]!.trigger('click')
    release()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(Object.keys(fetchMock.mock.calls[1]![1].body)).toHaveLength(8)
    expect(
      page.findAll('[role="switch"]').every((s) => s.attributes('aria-checked') === 'false'),
    ).toBe(true)
  })

  it('rolls a failed preset (bulk PATCH of 8 flags) back to the previous flags', async () => {
    stubPage()
    fetchMock.mockRejectedValue(new Error('offline'))
    const page = await render()
    await page.findAll('[role="radio"]')[0]!.trigger('click')
    await flushPromises()
    expect(Object.keys(fetchMock.mock.calls[0]![1].body)).toHaveLength(8)
    expect(
      page.findAll('[role="switch"]').every((s) => s.attributes('aria-checked') === 'true'),
    ).toBe(true)
    expect(page.findAll('[role="radio"]')[1]!.attributes('aria-checked')).toBe('true')
    expect(page.get('[role="alert"]').text()).toContain('Не удалось сохранить')
  })

  it('keeps the saved value and shows no error when refreshing shared data fails', async () => {
    stubPage()
    refreshData.mockRejectedValueOnce(new Error('refresh failed'))
    const page = await render()
    await page.get('[data-testid="feature-toggle-mvp"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(refreshData).toHaveBeenCalledWith('me-features')
    expect(page.get('[data-testid="feature-toggle-mvp"]').attributes('aria-checked')).toBe('false')
    expect(page.find('[role="alert"]').exists()).toBe(false)
  })

  it('shows an error state when features cannot be loaded', async () => {
    stubPage(defaultPlayerFeatures(), true)
    const page = await render()
    expect(page.text()).toContain('Не удалось загрузить функции')
    expect(page.find('[role="switch"]').exists()).toBe(false)
  })
})
