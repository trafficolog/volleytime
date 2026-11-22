import { describe, expect, it } from 'vitest'

import {
  buildMyCalendar,
  calendarClashDays,
  calendarDayTitle,
  calendarMonthCells,
  calendarToday,
  defaultCalendarDay,
  GROUP_COLOR_TOKENS,
  groupColors,
  myCalendarSubtitle,
  type MyCalendarEvent,
  type MyCalendarGroup,
} from './my-calendar'

const minsk: MyCalendarGroup = { id: 3, name: 'VolleyTime Минск', timezone: 'Europe/Minsk' }
const sunday: MyCalendarGroup = { id: 5, name: 'МинскВолей · Воскресные', timezone: 'Europe/Minsk' }
const beach: MyCalendarGroup = { id: 9, name: 'СпайкКлуб', timezone: 'UTC' }
const groups = [minsk, sunday, beach]

let nextId = 1
const game = (
  organizationId: number,
  startsAt: string,
  hours = 2,
  extra: Partial<MyCalendarEvent> = {},
): MyCalendarEvent => ({
  id: nextId++,
  organizationId,
  title: `Игра ${nextId}`,
  status: 'published',
  startsAt,
  endsAt: new Date(Date.parse(startsAt) + hours * 3600_000).toISOString(),
  capacity: 10,
  taken: 4,
  venue: null,
  locationText: null,
  myBooking: null,
  ...extra,
})
const going = { id: 1, status: 'confirmed', waitPos: null, waitlistSeats: 0 }
const queued = { id: 2, status: 'waitlisted', waitPos: 2, waitlistSeats: 0 }
const NOW = new Date('2026-06-02T10:00:00Z')

describe('group colours', () => {
  it('gives each group of the player its own fixed token in order of the group list', () => {
    const colors = groupColors(groups)
    expect(colors.get(3)).toBe(GROUP_COLOR_TOKENS[0])
    expect(colors.get(5)).toBe(GROUP_COLOR_TOKENS[1])
    expect(colors.get(9)).toBe(GROUP_COLOR_TOKENS[2])
    expect(new Set(colors.values()).size).toBe(3)
  })

  it('uses design tokens only and wraps around when there are more groups than tokens', () => {
    expect(GROUP_COLOR_TOKENS.every((c) => /^var\((--vt-[a-z0-9-]+)\)$/.test(c))).toBe(true)
    const many = Array.from({ length: GROUP_COLOR_TOKENS.length + 1 }, (_, i) => ({
      ...minsk,
      id: i + 1,
    }))
    expect(groupColors(many).get(many.length)).toBe(GROUP_COLOR_TOKENS[0])
  })
})

describe('buildMyCalendar', () => {
  const mine = game(3, '2026-06-10T17:00:00Z', 2, { myBooking: going })
  const waiting = game(5, '2026-06-11T08:00:00Z', 2, { myBooking: queued })
  const free = game(9, '2026-06-12T12:00:00Z', 2, { taken: 3 })
  const full = game(3, '2026-06-13T12:00:00Z', 2, { taken: 10 })
  const events = [mine, waiting, free, full]

  it('«Только мои» keeps going and queued games, with group, colour and participation', () => {
    const items = buildMyCalendar(events, groups, { filter: 'mine', groupId: null, now: NOW })
    expect(items.map((i) => i.event.id)).toEqual([mine.id, waiting.id])
    expect(items[0]).toMatchObject({
      group: minsk,
      color: GROUP_COLOR_TOKENS[0],
      participation: 'going',
      clash: false,
    })
    expect(items[1]).toMatchObject({ participation: 'waitlist', color: GROUP_COLOR_TOKENS[1] })
  })

  it('«С местами» adds upcoming games with free seats, never full or past ones', () => {
    const past = game(3, '2026-05-30T17:00:00Z', 2, { taken: 1 })
    const closed = game(3, '2026-06-14T17:00:00Z', 2, { taken: 1, status: 'closed' })
    const items = buildMyCalendar([...events, past, closed], groups, {
      filter: 'seats',
      groupId: null,
      now: NOW,
    })
    expect(items.map((i) => i.event.id)).toEqual([mine.id, waiting.id, free.id])
    expect(items[2]).toMatchObject({ participation: null, freeSeats: 7 })
  })

  it('filters by one group', () => {
    const items = buildMyCalendar(events, groups, { filter: 'seats', groupId: 9, now: NOW })
    expect(items.map((i) => i.event.id)).toEqual([free.id])
  })

  it('sorts by start and puts the game on the day of its own group time zone', () => {
    // 21:30Z — в Минске (UTC+3) уже следующие сутки, в UTC — ещё нет
    const late = game(3, '2026-06-20T21:30:00Z', 1, { myBooking: going })
    const lateUtc = game(9, '2026-06-20T21:30:00Z', 1, { myBooking: going })
    const items = buildMyCalendar([late, lateUtc], groups, {
      filter: 'mine',
      groupId: null,
      now: NOW,
    })
    // одно время начала: порядок по id
    expect(items.map((i) => [i.event.id, i.day])).toEqual([
      [late.id, '2026-06-21'],
      [lateUtc.id, '2026-06-20'],
    ])
    expect(items.find((i) => i.event.id === late.id)!.timeFrom).toBe('00:30')
    expect(items.find((i) => i.event.id === lateUtc.id)!.timeFrom).toBe('21:30')
  })

  it('ignores games of groups that are not in the list', () => {
    const stray = game(77, '2026-06-15T17:00:00Z', 2, { myBooking: going })
    expect(buildMyCalendar([stray], groups, { filter: 'mine', groupId: null, now: NOW })).toEqual(
      [],
    )
  })

  describe('time overlaps (amber)', () => {
    it('marks two going games of different groups that overlap, both of them', () => {
      const a = game(3, '2026-06-17T17:00:00Z', 2, { myBooking: going })
      const b = game(5, '2026-06-17T18:00:00Z', 2, { myBooking: going })
      const items = buildMyCalendar([a, b], groups, { filter: 'mine', groupId: null, now: NOW })
      expect(items.map((i) => i.clash)).toEqual([true, true])
      expect(calendarClashDays(items)).toEqual(['2026-06-17'])
    })

    it('does not mark back-to-back games, a queue place or a game I am not going to', () => {
      const a = game(3, '2026-06-17T17:00:00Z', 2, { myBooking: going })
      const touching = game(5, '2026-06-17T19:00:00Z', 2, { myBooking: going })
      const queue = game(9, '2026-06-17T17:30:00Z', 2, { myBooking: queued })
      const open = game(9, '2026-06-17T18:00:00Z', 2)
      const items = buildMyCalendar([a, touching, queue, open], groups, {
        filter: 'seats',
        groupId: null,
        now: NOW,
      })
      expect(items.every((i) => !i.clash)).toBe(true)
      expect(calendarClashDays(items)).toEqual([])
    })

    it('still marks the overlap when the other game is hidden by the group filter', () => {
      const a = game(3, '2026-06-17T17:00:00Z', 2, { myBooking: going })
      const b = game(5, '2026-06-17T18:00:00Z', 2, { myBooking: going })
      const items = buildMyCalendar([a, b], groups, { filter: 'mine', groupId: 3, now: NOW })
      expect(items).toHaveLength(1)
      expect(items[0]!.clash).toBe(true)
    })
  })
})

describe('calendarMonthCells', () => {
  it('builds Monday-first weeks of the month and puts items on their day', () => {
    const a = game(3, '2026-06-17T17:00:00Z', 2, { myBooking: going })
    const items = buildMyCalendar([a], groups, { filter: 'mine', groupId: null, now: NOW })
    const cells = calendarMonthCells('2026-06', items)
    expect(cells).toHaveLength(35)
    expect(cells[0]).toMatchObject({ day: '2026-06-01', number: 1, inMonth: true })
    expect(cells.find((c) => c.day === '2026-06-17')!.items).toHaveLength(1)
    expect(cells.filter((c) => c.items.length)).toHaveLength(1)
  })

  it('pads with days of the neighbour months that are not in the month', () => {
    const cells = calendarMonthCells('2026-07', [])
    expect(cells[0]).toMatchObject({ day: '2026-06-29', inMonth: false })
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31)
  })
})

describe('myCalendarSubtitle', () => {
  it('counts groups and going games of the month', () => {
    const a = game(3, '2026-06-17T17:00:00Z', 2, { myBooking: going })
    const b = game(5, '2026-06-18T17:00:00Z', 2, { myBooking: queued })
    const c = game(9, '2026-06-19T17:00:00Z', 2, { myBooking: going })
    expect(myCalendarSubtitle(groups, [a, b, c], '2026-06')).toBe('3 группы · 2 записи в июне')
    expect(myCalendarSubtitle([minsk], [], '2026-12')).toBe('1 группа · 0 записей в декабре')
  })
})

describe('days', () => {
  it('takes today from the time zone of the first group', () => {
    // 22:30Z: в Минске уже следующий день, в UTC ещё нет
    const at = new Date('2026-06-02T22:30:00Z')
    expect(calendarToday([minsk], at)).toBe('2026-06-03')
    expect(calendarToday([beach], at)).toBe('2026-06-02')
    expect(calendarToday([], at)).toBe('2026-06-03')
  })

  it('titles the day: today, tomorrow, then weekday and date', () => {
    expect(calendarDayTitle('2026-06-02', '2026-06-02')).toBe('Сегодня')
    expect(calendarDayTitle('2026-06-03', '2026-06-02')).toBe('Завтра')
    expect(calendarDayTitle('2026-06-10', '2026-06-02')).toBe('Ср, 10 июня')
  })

  it('opens today if it has games, else the next game day, else the last one', () => {
    const mk = (days: string[]) =>
      calendarMonthCells(
        '2026-06',
        buildMyCalendar(
          days.map((d) => game(3, `${d}T12:00:00Z`, 1, { myBooking: going })),
          groups,
          { filter: 'mine', groupId: null, now: NOW },
        ),
      )
    expect(defaultCalendarDay(mk(['2026-06-02', '2026-06-20']), '2026-06-02')).toBe('2026-06-02')
    expect(defaultCalendarDay(mk(['2026-06-01', '2026-06-20']), '2026-06-02')).toBe('2026-06-20')
    expect(defaultCalendarDay(mk(['2026-06-01', '2026-06-02']), '2026-06-10')).toBe('2026-06-02')
    // другой месяц — первый день с играми
    expect(defaultCalendarDay(mk(['2026-06-05', '2026-06-20']), '2026-07-02')).toBe('2026-06-05')
    expect(defaultCalendarDay(mk([]), '2026-06-02')).toBeNull()
  })
})
