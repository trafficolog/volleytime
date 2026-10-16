import { describe, expect, it } from 'vitest'

import {
  balanceDraftCount,
  buildSeriesRule,
  describeSeriesRule,
  eventsWord,
  newIdempotencyKey,
  seriesBalanceNote,
  seriesChipLabel,
  seriesResultLines,
  spanEndDate,
  toggleWeekday,
  type SeriesPreviewView,
} from './event-series'

const preview = (over: Partial<SeriesPreviewView> = {}): SeriesPreviewView => ({
  timezone: 'Europe/Minsk',
  dates: [],
  excluded: [],
  total: 14,
  published: 14,
  drafts: 0,
  venueConflicts: 0,
  balanceEnforced: true,
  balanceBefore: 32,
  balanceAfter: 18,
  ...over,
})

describe('spanEndDate', () => {
  it('turns a span into an inclusive until date (the last day before the same day N months later)', () => {
    expect(spanEndDate('2026-06-06', 'month')).toBe('2026-07-05')
    expect(spanEndDate('2026-06-06', 'quarter')).toBe('2026-09-05')
    expect(spanEndDate('2026-06-06', 'half')).toBe('2026-12-05')
    expect(spanEndDate('2026-06-06', 'year')).toBe('2027-06-05')
  })

  it('clamps to the last day of a shorter month and crosses the year', () => {
    expect(spanEndDate('2026-01-31', 'month')).toBe('2026-02-27')
    expect(spanEndDate('2026-11-15', 'quarter')).toBe('2027-02-14')
  })
})

describe('buildSeriesRule', () => {
  it('builds a once rule without weekdays or an end', () => {
    expect(
      buildSeriesRule({
        freq: 'once',
        weekdays: [6],
        startDate: '2026-06-06',
        endMode: 'span',
        span: 'quarter',
        count: 8,
      }),
    ).toEqual({ freq: 'once', weekdays: [], startDate: '2026-06-06' })
  })

  it('uses until for a span and count for the "N раз" mode, exactly one of them', () => {
    const base = {
      freq: 'weekly',
      weekdays: [6, 3],
      startDate: '2026-06-06',
      span: 'month',
    } as const
    expect(buildSeriesRule({ ...base, endMode: 'span', count: 8 })).toEqual({
      freq: 'weekly',
      weekdays: [3, 6],
      startDate: '2026-06-06',
      until: '2026-07-05',
    })
    expect(buildSeriesRule({ ...base, endMode: 'count', count: 8 })).toEqual({
      freq: 'weekly',
      weekdays: [3, 6],
      startDate: '2026-06-06',
      count: 8,
    })
  })
})

describe('toggleWeekday', () => {
  it('keeps at least one weekday and sorts ISO days', () => {
    expect(toggleWeekday([6], 6)).toEqual([6])
    expect(toggleWeekday([6], 1)).toEqual([1, 6])
    expect(toggleWeekday([1, 6], 6)).toEqual([1])
  })
})

describe('describeSeriesRule', () => {
  it('describes weekly and biweekly rules in Russian', () => {
    expect(describeSeriesRule('weekly', [6])).toBe('Каждую неделю по субботам')
    expect(describeSeriesRule('biweekly', [1, 3, 6])).toBe(
      'Раз в две недели по понедельникам, средам и субботам',
    )
    expect(describeSeriesRule('once', [])).toBe('Один раз')
  })
})

describe('eventsWord and chip labels', () => {
  it('declines "событие" for the count', () => {
    expect(eventsWord(1)).toBe('событие')
    expect(eventsWord(2)).toBe('события')
    expect(eventsWord(5)).toBe('событий')
    expect(eventsWord(11)).toBe('событий')
    expect(eventsWord(21)).toBe('событие')
  })

  it('labels a date chip with weekday and DD.MM', () => {
    expect(seriesChipLabel('2026-06-06')).toBe('Сб 6.06')
    expect(seriesChipLabel('2026-12-28')).toBe('Пн 28.12')
  })
})

describe('seriesBalanceNote', () => {
  it('says the balance is not charged when the switch is off', () => {
    expect(seriesBalanceNote(preview({ balanceEnforced: false }))).toEqual({
      tone: 'neutral',
      text: 'Баланс событий пока не списывается: все даты будут опубликованы.',
    })
  })

  it('shows what is charged and what remains when the balance is enough', () => {
    expect(seriesBalanceNote(preview())).toEqual({
      tone: 'neutral',
      text: 'Спишется 14 событий из баланса событий — по одному на событие. На балансе 32, останется 18.',
    })
  })

  it('announces drafts when the balance is short (D-04): the first N are published', () => {
    const note = seriesBalanceNote(
      preview({
        total: 14,
        published: 5,
        drafts: 9,
        balanceBefore: 5,
        balanceAfter: 0,
        dates: Array.from({ length: 14 }, (_, i) => ({
          date: `2026-06-${String(6 + i).padStart(2, '0')}`,
          startsAt: '',
          endsAt: '',
          status: i < 5 ? ('published' as const) : ('draft' as const),
          draftReason: i < 5 ? null : ('balance' as const),
        })),
      }),
    )
    expect(note.tone).toBe('warning')
    expect(note.text).toBe(
      'Нужно 14 событий, на балансе событий 5. Опубликуем первые 5, остальные 9 станут черновиками до пополнения.',
    )
  })

  it('does not blame the balance for drafts caused only by a venue conflict', () => {
    const dates = [
      { date: '2026-06-06', startsAt: '', endsAt: '', status: 'published', draftReason: null },
      {
        date: '2026-06-13',
        startsAt: '',
        endsAt: '',
        status: 'draft',
        draftReason: 'venue_conflict',
      },
    ] as SeriesPreviewView['dates']
    const view = preview({ total: 2, published: 1, drafts: 1, venueConflicts: 1, dates })
    expect(balanceDraftCount(view)).toBe(0)
    expect(seriesBalanceNote(view).tone).toBe('neutral')
  })
})

describe('newIdempotencyKey', () => {
  it('matches the API contract: 8-64 chars of [A-Za-z0-9_-], different each time', () => {
    const a = newIdempotencyKey()
    const b = newIdempotencyKey()
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(a).not.toBe(b)
  })
})

describe('seriesResultLines', () => {
  const result = {
    total: 14,
    published: 12,
    drafts: 2,
    venueConflicts: 1 as number | null,
    balanceAfter: 20,
    replayed: false,
  }

  it('summarises what was created, drafts and the balance left', () => {
    expect(seriesResultLines(result)).toEqual([
      'Создано 14 событий: опубликовано 12, черновиков 2.',
      'Одна дата создана черновиком: в зале уже есть бронь на это время.',
      'Баланс событий: осталось 20.',
    ])
  })

  it('says nothing about uncounted conflicts and explains a replay', () => {
    expect(
      seriesResultLines({
        ...result,
        drafts: 0,
        published: 14,
        venueConflicts: null,
        replayed: true,
      }),
    ).toEqual([
      'Создано 14 событий: опубликовано 14, черновиков 0.',
      'Это повтор запроса: серия уже была создана, баланс повторно не списан.',
      'Баланс событий: осталось 20.',
    ])
  })
})
