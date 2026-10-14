import { describe, expect, it } from 'vitest'

import {
  appendDesktopEventPage,
  buildMonthGrid,
  eventFilterQuery,
  groupEventsByOrgDay,
  monthOfInstant,
  shiftMonth,
} from './desktop-calendar'

const event = (id: number, startsAt: string) => ({
  id,
  title: `Событие ${id}`,
  startsAt,
  endsAt: startsAt,
  status: 'published',
  capacity: 12,
  price: 2500,
  currency: 'BYN',
  taken: 0,
  waitlist: 0,
  myBooking: null,
  venue: null,
  locationText: null,
})

describe('desktop event calendar', () => {
  it('uses the organization day across a UTC midnight boundary', () => {
    const groups = groupEventsByOrgDay([event(1, '2026-09-26T22:30:00Z')], 'Europe/Minsk')
    expect([...groups.keys()]).toEqual(['2026-09-27'])
  })

  it('preserves same-day server order and handles an empty list', () => {
    expect([...groupEventsByOrgDay([], 'Europe/Minsk')]).toEqual([])
    const groups = groupEventsByOrgDay(
      [event(2, '2026-09-27T09:00:00Z'), event(1, '2026-09-27T08:00:00Z')],
      'Europe/Minsk',
    )
    expect(groups.get('2026-09-27')?.map((item) => item.id)).toEqual([2, 1])
  })

  it('appends 50+ events only at the next offset, without duplicate records', () => {
    const first = Array.from({ length: 50 }, (_, i) => event(i + 1, '2026-10-01T12:00:00Z'))
    const second = [event(51, '2026-10-02T12:00:00Z'), event(52, '2026-10-03T12:00:00Z')]
    expect(appendDesktopEventPage(first, second, 50).map((item) => item.id)).toHaveLength(52)
    expect(appendDesktopEventPage(first, second, 49)).toEqual(first)
    expect(appendDesktopEventPage(first, [first[49]!, ...second], 50)).toHaveLength(52)
  })
})

describe('cabinet events filters (20.5.4)', () => {
  it('maps each chip to the list API query', () => {
    expect(eventFilterQuery('all')).toEqual({ filter: 'all' })
    expect(eventFilterQuery('open')).toEqual({ filter: 'upcoming', status: 'published' })
    expect(eventFilterQuery('past')).toEqual({ filter: 'past' })
    expect(eventFilterQuery('cancelled')).toEqual({ filter: 'all', status: 'cancelled' })
  })
})

describe('month navigation (20.5.4)', () => {
  it('shifts months across a year boundary', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('resolves the current month in the organization time zone', () => {
    expect(monthOfInstant(new Date('2026-09-30T22:30:00Z'), 'Europe/Minsk')).toBe('2026-10')
  })

  it('builds a Monday-first grid with leading and trailing days of adjacent months', () => {
    const grid = buildMonthGrid('2026-05', [])
    expect(grid).toHaveLength(35)
    expect(grid[0]).toMatchObject({ day: '2026-04-27', inMonth: false })
    expect(grid[4]).toMatchObject({ day: '2026-05-01', inMonth: true })
    expect(grid[34]).toMatchObject({ day: '2026-05-31', inMonth: true })
  })

  it('puts events into their organization day, ordered by start time', () => {
    const grouped = groupEventsByOrgDay(
      [event(2, '2026-05-28T17:00:00Z'), event(1, '2026-05-28T15:00:00Z')],
      'Europe/Minsk',
    )
    const cell = buildMonthGrid(
      '2026-05',
      [...grouped].flatMap(([, items]) => items),
      'Europe/Minsk',
    ).find((c) => c.day === '2026-05-28')
    expect(cell?.events.map((e) => e.id)).toEqual([1, 2])
  })
})

describe('org-day grouping at timezone edges (20.5.4)', () => {
  const days = (iso: string, tz: string) => [...groupEventsByOrgDay([event(1, iso)], tz).keys()][0]

  it('splits at local midnight on both sides', () => {
    expect(days('2026-05-31T20:59:59Z', 'Europe/Minsk')).toBe('2026-05-31')
    expect(days('2026-05-31T21:00:00Z', 'Europe/Minsk')).toBe('2026-06-01')
  })

  it('follows the offset across a DST change (America/New_York)', () => {
    // 2026-03-08: EST (UTC-5) -> EDT (UTC-4) at 02:00 local
    expect(days('2026-03-08T04:59:00Z', 'America/New_York')).toBe('2026-03-07')
    expect(days('2026-03-08T05:00:00Z', 'America/New_York')).toBe('2026-03-08')
    expect(days('2026-03-09T03:59:00Z', 'America/New_York')).toBe('2026-03-08')
    expect(days('2026-03-09T04:00:00Z', 'America/New_York')).toBe('2026-03-09')
  })

  it('keeps the 25-hour fall-back day together', () => {
    // 2026-11-01: EDT -> EST, local day spans 04:00Z .. 04:59Z next UTC day... until 05:00Z
    expect(days('2026-11-01T03:59:00Z', 'America/New_York')).toBe('2026-10-31')
    expect(days('2026-11-02T04:59:00Z', 'America/New_York')).toBe('2026-11-01')
    expect(days('2026-11-02T05:00:00Z', 'America/New_York')).toBe('2026-11-02')
  })
})
