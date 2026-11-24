// @vitest-environment happy-dom
import type { ReportBreakdown } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import ReportsBreakdown from './ReportsBreakdown.vue'

import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import Icon from '~/components/vt/Icon.vue'
import Segment from '~/components/vt/Segment.vue'

const breakdown: ReportBreakdown = {
  dimension: 'coach',
  currency: 'BYN',
  period: { from: '2026-05-01', to: '2026-05-31' },
  rows: [
    {
      key: 4,
      label: 'Ольга Романова',
      events: 8,
      seats: 61,
      capacity: 80,
      percent: 76,
      income: 123_450,
      rent: 40_000,
    },
    {
      key: null,
      label: null,
      events: 2,
      seats: 4,
      capacity: 20,
      percent: 20,
      income: 2_000,
      rent: 0,
    },
  ],
  totals: { events: 10, seats: 65, capacity: 100, percent: 65, income: 125_450, rent: 40_000 },
}

const mountIt = (props: Record<string, unknown> = {}) =>
  mount(ReportsBreakdown, {
    props: { dimension: 'coach', breakdown, pending: false, error: false, ...props },
    global: { components: { VtSegment: Segment, VtIcon: Icon, ErrorState, SkeletonList } },
  })

describe('ReportsBreakdown (W-19)', () => {
  beforeEach(() => {
    // иконка ошибки — авто-импорт Nuxt
    vi.stubGlobal('computed', computed)
  })

  it('shows the switch, the four columns, the rows and the total', () => {
    const wrapper = mountIt()

    const options = wrapper.findAll('[role="radio"]')
    expect(options.map((o) => o.text())).toEqual(['По тренерам', 'По залам', 'По сериям'])
    expect(options[0]!.attributes('aria-checked')).toBe('true')
    expect(wrapper.findAll('thead th').map((h) => h.text())).toEqual([
      'Тренер',
      'Игр',
      'Заполняемость',
      'Выручка',
      'Аренда',
    ])
    const rows = wrapper.findAll('tbody tr').map((r) => r.findAll('th, td').map((c) => c.text()))
    expect(rows[0]).toEqual(['Ольга Романова', '8', '76%', '1 234,50 BYN', '400,00 BYN'])
    expect(rows[1]![0]).toBe('Без тренера')
    expect(wrapper.findAll('tfoot td').map((c) => c.text())).toEqual([
      '10',
      '65%',
      '1 254,50 BYN',
      '400,00 BYN',
    ])
  })

  it('asks for another breakdown when a switch option is chosen', async () => {
    const wrapper = mountIt()
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:dimension')).toEqual([['venue']])
  })

  it('labels the first column by the chosen dimension', () => {
    const wrapper = mountIt({
      dimension: 'series',
      breakdown: { ...breakdown, dimension: 'series' },
    })
    expect(wrapper.get('thead th').text()).toBe('Серия')
  })

  it('shows an empty state, a skeleton and a retryable error', async () => {
    expect(mountIt({ breakdown: { ...breakdown, rows: [] } }).text()).toContain(
      'За период нет событий и денег',
    )
    expect(mountIt({ breakdown: null, pending: true }).findComponent(SkeletonList).exists()).toBe(
      true,
    )
    const failed = mountIt({ breakdown: null, error: true })
    expect(failed.get('[role="alert"]').text()).toContain('Не удалось загрузить разрез')
    await failed.get('[role="alert"] button').trigger('click')
    expect(failed.emitted('retry')).toHaveLength(1)
  })
})
