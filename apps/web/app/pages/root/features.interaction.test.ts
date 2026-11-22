// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref, Suspense } from 'vue'

import Features from './features.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'

const API = '/api/platform/feature-analytics'
const apiFetch = vi.fn()
const navigateTo = vi.fn()
let wrapper: VueWrapper | undefined

const shown = (players: number, value: number) => ({ players, value, suppressed: false })
const hidden = { players: null, value: null, suppressed: true }

const row = (feature: string, over: Record<string, unknown> = {}) => ({
  feature,
  disabledShare: shown(40, 0.25),
  weeklyActive: shown(12, 12),
  retention: shown(15, 0.6),
  bookingFrequency: { on: shown(30, 2.5), off: shown(10, 1.2) },
  ...over,
})

const FEATURES = ['cal', 'coach', 'warmup', 'self', 'mvp', 'teams', 'streak', 'wrapped']

const report = (
  features: unknown[] = FEATURES.map((f) => row(f)),
  players: number | null = 40,
) => ({
  generatedAt: '2026-11-22T10:00:00.000Z',
  minCohort: 10,
  retentionDays: 28,
  windows: { activeDays: 7, retentionDays: 28, frequencyDays: 28 },
  players,
  features,
})

beforeEach(() => {
  apiFetch.mockReset()
  navigateTo.mockReset()
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useHead', () => undefined)
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('createError', (e: unknown) => Object.assign(new Error('createError'), e))
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('$fetch', apiFetch)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Features) }) }),
    {
      attachTo: document.body,
      global: {
        components: { EmptyState, ErrorState, SkeletonList },
        stubs: { VtIcon: true },
      },
    },
  )
  await flushPromises()
  return wrapper
}

const cell = (w: VueWrapper, feature: string, metric: string) =>
  w.get(`[data-feature="${feature}"] [data-metric="${metric}"]`)

describe('root feature analytics page (P-14, 23.1.2)', () => {
  it('requests the report and shows one row per feature with labels and metrics', async () => {
    apiFetch.mockResolvedValue(report())
    const w = await render()
    expect(apiFetch).toHaveBeenCalledWith(API)
    expect(w.findAll('tbody tr')).toHaveLength(8)
    expect(w.get('[data-feature="cal"] th').text()).toBe('Календарь')
    expect(w.get('[data-feature="wrapped"] th').text()).toBe('Итоги сезона')
    expect(cell(w, 'cal', 'disabledShare').text()).toContain('25')
    expect(cell(w, 'cal', 'weeklyActive').text()).toContain('12')
    expect(cell(w, 'cal', 'retention').text()).toContain('60')
    expect(cell(w, 'cal', 'frequencyOn').text()).toContain('2,5')
    expect(cell(w, 'cal', 'frequencyOff').text()).toContain('1,2')
    expect(w.get('[data-testid="features-players"]').text()).toBe('Игроков платформы: 40')
  })

  it('shows the window and definition hints from the contract', async () => {
    apiFetch.mockResolvedValue(report())
    const w = await render()
    const text = w.get('dl').text()
    expect(text).toContain('7 суток')
    expect(text).toContain('от 56 до 28 суток назад')
    expect(text).toContain('следующие 28 суток')
    expect(text).toContain('меньше 10')
  })

  it('renders suppressed cohorts as «мало данных» with no numbers', async () => {
    apiFetch.mockResolvedValue(
      report(
        [
          row('cal', {
            disabledShare: hidden,
            retention: hidden,
            bookingFrequency: { on: hidden, off: hidden },
          }),
        ],
        null,
      ),
    )
    const w = await render()
    for (const m of ['disabledShare', 'retention', 'frequencyOn', 'frequencyOff']) {
      const c = cell(w, 'cal', m)
      expect(c.text()).toBe('мало данных')
      expect(c.attributes('data-suppressed')).toBe('true')
    }
    // открытая метрика рядом остаётся числом
    expect(cell(w, 'cal', 'weeklyActive').attributes('data-suppressed')).toBe('false')
    expect(w.get('[data-testid="features-players"]').text()).toBe('Игроков платформы: мало данных')
  })

  it('shows the empty state when there are no features', async () => {
    apiFetch.mockResolvedValue(report([]))
    const w = await render()
    expect(w.text()).toContain('Данных пока нет')
    expect(w.find('table').exists()).toBe(false)
  })

  it('shows an error with retry on a failed load, then the report', async () => {
    apiFetch.mockRejectedValueOnce({ statusCode: 500 }).mockResolvedValueOnce(report())
    const w = await render()
    expect(w.text()).toContain('Не удалось загрузить отчёт')
    await w.get('button').trigger('click')
    await flushPromises()
    expect(w.findAll('tbody tr')).toHaveLength(8)
  })

  it('sends a signed-out visitor to sign-in on 401', async () => {
    apiFetch.mockRejectedValue({ statusCode: 401 })
    await render()
    expect(navigateTo).toHaveBeenCalledWith('/auth/login')
  })

  it('turns 403 (signed in, not root) into the 403 error page and shows no data', async () => {
    apiFetch.mockRejectedValue({ statusCode: 403 })
    const errors: unknown[] = []
    wrapper = mount(
      defineComponent({ render: () => h(Suspense, null, { default: () => h(Features) }) }),
      {
        global: {
          components: { EmptyState, ErrorState, SkeletonList },
          stubs: { VtIcon: true },
          config: { errorHandler: (e: unknown) => errors.push(e) },
        },
      },
    )
    await flushPromises()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ statusCode: 403, fatal: true })
    expect(wrapper.find('table').exists()).toBe(false)
  })
})
