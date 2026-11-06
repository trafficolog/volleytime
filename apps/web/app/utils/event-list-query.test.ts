import { describe, expect, it } from 'vitest'

import {
  eventExportHref,
  eventListApiQuery,
  eventListRouteQuery,
  eventPageCount,
  hasActiveEventFilters,
  parseEventListQuery,
  periodError,
} from './event-list-query'

describe('event list URL state (21.2.10)', () => {
  it('defaults, and drops invalid values', () => {
    const d = parseEventListQuery({})
    expect(d).toMatchObject({ tab: 'all', view: 'list', q: '', venueId: null, page: 1 })
    expect(eventListRouteQuery(d)).toEqual({})
    const bad = parseEventListQuery({
      tab: 'x',
      venue: '-3',
      page: '0',
      from: '2026-05-10',
      to: '2026-01-01',
    })
    expect(bad).toMatchObject({ tab: 'all', venueId: null, page: 1, from: '', to: '' })
    expect(parseEventListQuery({ page: 'abc' }).page).toBe(1)
  })

  it('round-trips search, panel, period, page, tab and view', () => {
    const query = {
      tab: 'past',
      view: 'calendar',
      q: 'Основа',
      venue: '7',
      from: '2026-05-01',
      to: '2026-05-31',
      page: '3',
      panel: '1',
    }
    const state = parseEventListQuery(query)
    expect(state.venueId).toBe(7)
    expect(eventListRouteQuery(state)).toEqual(query)
  })

  it('builds API params with the page offset and keeps the status chip mapping', () => {
    const state = parseEventListQuery({ tab: 'cancelled', q: ' Игра ', venue: '2', page: '3' })
    expect(eventListApiQuery(state)).toEqual({
      filter: 'all',
      status: 'cancelled',
      q: 'Игра',
      venueId: 2,
      limit: 25,
      offset: 50,
    })
  })

  it('builds the export link from the same filters without the page', () => {
    const state = parseEventListQuery({
      tab: 'open',
      q: 'a&b',
      from: '2026-05-01',
      to: '2026-05-02',
      page: '4',
    })
    const href = eventExportHref(5, state)
    expect(href.startsWith('/api/organizations/5/events/export?')).toBe(true)
    const params = new URL(href, 'http://x').searchParams
    expect(Object.fromEntries(params)).toEqual({
      filter: 'upcoming',
      status: 'published',
      q: 'a&b',
      from: '2026-05-01',
      to: '2026-05-02',
    })
  })

  it('validates the period', () => {
    expect(periodError('', '')).toBeNull()
    expect(periodError('2026-05-01', '')).toMatch(/обе даты/)
    expect(periodError('2026-05-05', '2026-05-01')).toMatch(/раньше/)
    expect(periodError('2026-01-01', '2026-03-31')).toMatch(/62/)
    expect(periodError('2026-05-01', '2026-05-01')).toBeNull()
    expect(periodError('2026-01-01', '2026-03-03')).toBeNull()
  })

  it('counts pages and detects active filters', () => {
    expect([0, 1, 25, 26, 50, 51].map(eventPageCount)).toEqual([1, 1, 1, 2, 2, 3])
    expect(hasActiveEventFilters(parseEventListQuery({}))).toBe(false)
    expect(hasActiveEventFilters(parseEventListQuery({ q: 'x' }))).toBe(true)
    expect(hasActiveEventFilters(parseEventListQuery({ tab: 'past' }))).toBe(true)
    expect(hasActiveEventFilters(parseEventListQuery({ page: '2' }))).toBe(false)
  })
})
