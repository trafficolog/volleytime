import { describe, expect, it } from 'vitest'

import { bookingWindowOf, closeBeforeLabel } from './event-booking-window'

const tz = 'Europe/Minsk'
const event = {
  startsAt: '2099-10-02T17:00:00Z',
  bookingOpensAt: null as string | null,
  closeBeforeMinutes: 120,
}
const now = new Date('2099-10-01T10:00:00Z')

describe('closeBeforeLabel', () => {
  it.each([
    [60, 'за 1 ч'],
    [120, 'за 2 ч'],
    [360, 'за 6 ч'],
    [1440, 'за 24 ч'],
  ])('%i мин', (minutes, text) => expect(closeBeforeLabel(minutes)).toBe(text))
})

describe('bookingWindowOf: время открытия и закрытия записи (20.3.1)', () => {
  it('без времени открытия запись открыта с публикации', () => {
    expect(bookingWindowOf(event, tz, true, now).opens).toBe('открыта с публикации')
  })

  it('время открытия в будущем и прошлом', () => {
    const future = bookingWindowOf(
      { ...event, bookingOpensAt: '2099-10-01T15:30:00Z' },
      tz,
      true,
      now,
    ).opens
    expect(future).toContain('откроется')
    expect(future).toContain('18:30')
    const past = bookingWindowOf(
      { ...event, bookingOpensAt: '2099-10-01T09:00:00Z' },
      tz,
      true,
      now,
    )
    expect(past.opens).toContain('открылась')
  })

  it('закрытие: «за N ч» и момент в часовом поясе группы', () => {
    const w = bookingWindowOf(event, tz, true, now)
    expect(w.closes).toBe('за 2 ч до начала (в 18:00)')
  })

  it('планировщик выключен: автозакрытия нет, строки закрытия нет', () => {
    expect(bookingWindowOf(event, tz, false, now).closes).toBeNull()
  })
})
