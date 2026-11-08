import { describe, expect, it } from 'vitest'

import { buildEventsCsv, eventStatusLabel, type EventCsvRow } from './csv'

const now = new Date('2026-05-20T09:00:00Z')
const row = (over: Partial<EventCsvRow> = {}): EventCsvRow => ({
  title: 'Основа',
  startsAt: new Date('2026-05-25T17:00:00Z'),
  endsAt: new Date('2026-05-25T19:00:00Z'),
  status: 'published',
  capacity: 14,
  taken: 12,
  place: 'Школа №24',
  ...over,
})

describe('buildEventsCsv (21.2.10)', () => {
  it('starts with a BOM, uses ";" and CRLF, and ends with a line break', () => {
    const csv = buildEventsCsv([row()], 'Europe/Minsk', now)
    expect(csv.startsWith('﻿Дата;Название;Зал;Места;Статус\r\n')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    const [, line] = csv.replace('﻿', '').trimEnd().split('\r\n')
    expect(line).toMatch(/;Основа;Школа №24;12 из 14;Открыта запись$/)
  })

  it('neutralises leading =, +, -, @ and quotes separators', () => {
    const csv = buildEventsCsv(
      ['=1+1', '+1', '-1', '@x', 'a;b'].map((title) => row({ title, place: null })),
      'UTC',
      now,
    )
    const lines = csv.trimEnd().split('\r\n').slice(1)
    expect(lines.map((l) => l.split(';').slice(1, 2)[0])).toEqual([
      "'=1+1",
      "'+1",
      "'-1",
      "'@x",
      '"a',
    ])
    expect(lines[4]).toContain('"a;b"')
  })

  it('header only for an empty list', () => {
    expect(buildEventsCsv([], 'UTC', now)).toBe('﻿Дата;Название;Зал;Места;Статус\r\n')
  })

  it('maps statuses like the cabinet table', () => {
    const at = (over: Partial<EventCsvRow>) => eventStatusLabel(row(over), now)
    expect(at({ status: 'cancelled' })).toBe('Отменена')
    expect(at({ status: 'draft' })).toBe('Черновик')
    expect(at({ status: 'finished' })).toBe('Прошла')
    expect(at({ endsAt: new Date('2026-05-19T00:00:00Z') })).toBe('Прошла')
    expect(at({ status: 'closed' })).toBe('Запись закрыта')
    expect(at({ startsAt: new Date('2026-05-20T08:00:00Z') })).toBe('Запись закрыта')
    expect(at({})).toBe('Открыта запись')
  })
})
