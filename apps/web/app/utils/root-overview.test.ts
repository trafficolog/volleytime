import type { PlatformGateMetric, PlatformOverview } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  bookingBars,
  gateMetricView,
  rootNavItems,
  rootOverviewFailure,
  rootOverviewView,
  weekDeltaLabel,
} from './root-overview'

const metric = (over: Partial<PlatformGateMetric>): PlatformGateMetric => ({
  key: 'totalEvents',
  value: 10,
  target: 50,
  reached: false,
  ...over,
})

describe('rootOverviewFailure', () => {
  it('maps API statuses to the page reaction', () => {
    expect(rootOverviewFailure(403)).toBe('forbidden')
    expect(rootOverviewFailure(401)).toBe('login')
    expect(rootOverviewFailure(500)).toBe('failed')
    expect(rootOverviewFailure(undefined)).toBe('failed')
  })
})

describe('rootNavItems', () => {
  it('links only the screens that exist and keeps the rest as disabled placeholders', () => {
    const items = rootNavItems()
    expect(items[0]).toMatchObject({ key: 'overview', label: 'Обзор платформы', to: '/root' })
    expect(items.filter((i) => i.to !== null).map((i) => i.key)).toEqual(['overview'])
    expect(items.map((i) => i.key)).toEqual([
      'overview',
      'organizations',
      'users',
      'billing',
      'audit',
      'settings',
    ])
  })
})

describe('weekDeltaLabel', () => {
  it('shows growth, drop and no change against the previous week', () => {
    expect(weekDeltaLabel({ current: 38, previous: 29 })).toEqual({
      text: '+9 к прошлой неделе',
      direction: 'up',
    })
    expect(weekDeltaLabel({ current: 3, previous: 5 })).toEqual({
      text: '−2 к прошлой неделе',
      direction: 'down',
    })
    expect(weekDeltaLabel({ current: 4, previous: 4 })).toEqual({
      text: 'без изменений к прошлой неделе',
      direction: 'flat',
    })
  })
})

describe('gateMetricView', () => {
  it('names the metric, shows value against target and the progress', () => {
    expect(gateMetricView(metric({ key: 'totalEvents', value: 10, target: 50 }))).toMatchObject({
      label: 'Событий создано',
      valueText: '10 / 50',
      percent: 20,
      state: 'progress',
      statusText: 'на пути',
    })
  })
  it('caps progress at 100 and marks a reached target', () => {
    expect(
      gateMetricView(metric({ key: 'activeOrganizers', value: 5, target: 2, reached: true })),
    ).toMatchObject({ percent: 100, state: 'reached', statusText: 'цель достигнута' })
  })
  it('flags a metric with nothing yet as a risk', () => {
    expect(gateMetricView(metric({ key: 'retention4weeks', value: 0, target: 1 }))).toMatchObject({
      label: 'Ретеншн: 4 недели подряд',
      percent: 0,
      state: 'risk',
      statusText: 'нет данных',
    })
  })
})

describe('bookingBars', () => {
  it('scales bars to the busiest day with a visible minimum and marks today', () => {
    const bars = bookingBars([
      { date: '2026-11-16', count: 0 },
      { date: '2026-11-17', count: 5 },
      { date: '2026-11-18', count: 10 },
    ])
    expect(bars.map((b) => b.height)).toEqual([4, 50, 100])
    expect(bars.map((b) => b.today)).toEqual([false, false, true])
  })
  it('does not divide by zero on an empty series', () => {
    expect(bookingBars([{ date: '2026-11-18', count: 0 }]).map((b) => b.height)).toEqual([4])
    expect(bookingBars([])).toEqual([])
  })
})

describe('rootOverviewView', () => {
  const overview: PlatformOverview = {
    generatedAt: '2026-11-18T12:00:00.000Z',
    northStar: { activeThisWeek: 4, activePreviousWeek: 3, registered: 5 },
    week: { events: { current: 38, previous: 29 }, bookings: { current: 438, previous: 351 } },
    bookingsDaily: [{ date: '2026-11-18', count: 7 }],
    gate: [metric({})],
  }
  it('assembles the screen model from the API response', () => {
    const v = rootOverviewView(overview)
    expect(v.subtitle).toBe('5 организаций')
    expect(v.northStar).toMatchObject({
      value: 4,
      delta: { text: '+1 к прошлой неделе', direction: 'up' },
      caption: 'из 5 зарегистрированных',
    })
    expect(v.events).toMatchObject({ value: 38 })
    expect(v.bookings).toMatchObject({ value: 438 })
    expect(v.bookingsTotal14d).toBe(7)
    expect(v.reachedCount).toBe(0)
    expect(v.gate).toHaveLength(1)
  })
  it('pluralizes the organization count', () => {
    const one = rootOverviewView({
      ...overview,
      northStar: { ...overview.northStar, registered: 1 },
    })
    expect(one.subtitle).toBe('1 организация')
  })
})
