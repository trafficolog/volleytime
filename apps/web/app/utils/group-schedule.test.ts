import { describe, expect, it } from 'vitest'

import type { EventListItem } from '../components/EventCard.vue'

import {
  countGoing,
  countTrainings,
  firstEventDay,
  groupScheduleWeeks,
  isMineEvent,
  scheduleDayTitle,
  scheduleDot,
  scheduleMonthRange,
  scheduleMonthTitle,
  scheduleSubtitle,
  trainingsLabel,
} from './group-schedule'

const TZ = 'Europe/Minsk'
const event = (
  id: number,
  startsAt: string,
  extra: Partial<EventListItem> = {},
): EventListItem => ({
  id,
  title: `Игра ${id}`,
  startsAt,
  endsAt: startsAt,
  status: 'published',
  capacity: 14,
  price: 0,
  currency: 'BYN',
  taken: 5,
  waitlist: 0,
  myBooking: null,
  venue: null,
  locationText: null,
  ...extra,
})
const going = { id: 1, status: 'confirmed' }
const queue = { id: 2, status: 'waitlisted', waitPos: 2 }

describe('group schedule month helpers', () => {
  it('builds the inclusive day range of a month, including leap February', () => {
    expect(scheduleMonthRange('2026-06')).toEqual({ from: '2026-06-01', to: '2026-06-30' })
    expect(scheduleMonthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(scheduleMonthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })

  it('titles months and days in Russian', () => {
    expect(scheduleMonthTitle('2026-06')).toBe('Июнь 2026')
    expect(scheduleDayTitle('2026-06-03')).toBe('3 июня')
  })

  it('declines "тренировка" and builds the role subtitle', () => {
    expect([1, 2, 5, 11, 12, 21, 22].map(trainingsLabel)).toEqual([
      '1 тренировка',
      '2 тренировки',
      '5 тренировок',
      '11 тренировок',
      '12 тренировок',
      '21 тренировка',
      '22 тренировки',
    ])
    const list = [
      event(1, '2026-06-03T17:00:00Z', { myBooking: going }),
      event(2, '2026-06-05T16:30:00Z'),
      event(3, '2026-06-07T07:00:00Z', { status: 'cancelled', myBooking: going }),
      event(4, '2026-06-10T17:00:00Z', { status: 'draft' }),
    ]
    expect(countTrainings(list)).toBe(2)
    expect(countGoing(list)).toBe(1)
    expect(scheduleSubtitle(list, 'player')).toBe('2 тренировки · вы записаны на 1')
    expect(scheduleSubtitle(list, 'org')).toBe('2 тренировки · вся группа')
  })
})

describe('schedule dots and "Мои"', () => {
  it('marks going, waitlist and plain events; cancelled never counts as participation', () => {
    expect(scheduleDot(event(1, '2026-06-03T17:00:00Z', { myBooking: going }))).toBe('going')
    expect(
      scheduleDot(
        event(1, '2026-06-03T17:00:00Z', { myBooking: { id: 1, status: 'pending_payment' } }),
      ),
    ).toBe('going')
    expect(scheduleDot(event(1, '2026-06-03T17:00:00Z', { myBooking: queue }))).toBe('queue')
    expect(scheduleDot(event(1, '2026-06-03T17:00:00Z'))).toBe('plain')
    expect(
      scheduleDot(event(1, '2026-06-03T17:00:00Z', { status: 'cancelled', myBooking: going })),
    ).toBe('plain')
    expect(isMineEvent(event(1, '2026-06-03T17:00:00Z', { myBooking: queue }))).toBe(true)
    expect(isMineEvent(event(1, '2026-06-03T17:00:00Z'))).toBe(false)
  })
})

describe('week grouping and default day', () => {
  // июнь 2026: 1 июня — понедельник
  const list = [
    event(1, '2026-06-03T17:00:00Z'),
    event(2, '2026-06-05T16:30:00Z'),
    event(3, '2026-06-05T08:00:00Z'),
    event(4, '2026-06-07T07:00:00Z'),
    event(5, '2026-06-17T17:00:00Z'),
  ]

  it('groups by Monday-first week, labels by first and last event day, skips empty weeks', () => {
    const weeks = groupScheduleWeeks('2026-06', list, TZ)
    expect(weeks.map((w) => w.label)).toEqual(['3–7 июня', '17 июня'])
    expect(weeks[0]!.events.map((e) => e.id)).toEqual([1, 3, 2, 4])
  })

  it('uses the organization day for late-evening events', () => {
    // 22:30 UTC 30 июня = 01:30 1 июля по Минску
    const weeks = groupScheduleWeeks('2026-07', [event(9, '2026-06-30T22:30:00Z')], TZ)
    expect(weeks.map((w) => w.label)).toEqual(['1 июля'])
  })

  it('picks the first day with events', () => {
    expect(firstEventDay('2026-06', list, TZ)).toBe('2026-06-03')
    expect(firstEventDay('2026-06', [], TZ)).toBeNull()
  })
})
