import { describe, expect, it } from 'vitest'

import { appendDesktopEventPage, groupEventsByOrgDay } from './desktop-calendar'

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
