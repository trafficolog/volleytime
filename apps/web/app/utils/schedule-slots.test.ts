import { describe, expect, it } from 'vitest'

import {
  nextSlotStart,
  slotLabel,
  slotRequestBody,
  validateSlotForm,
  weekdayShort,
  type ScheduleSlotView,
  type SlotFormValues,
} from './schedule-slots'

const slot = (over: Partial<ScheduleSlotView> = {}): ScheduleSlotView => ({
  id: 1,
  weekday: 1,
  startTime: '20:00',
  durationMinutes: 120,
  title: 'Основа',
  type: 'training',
  capacity: 12,
  venueId: null,
  venueName: null,
  venueArchived: false,
  ...over,
})

// Среда 2026-11-04, 12:00 по Минску (UTC+3)
const WED_NOON = new Date('2026-11-04T09:00:00Z')

describe('nextSlotStart', () => {
  it('picks the nearest matching weekday in the group time zone', () => {
    expect(nextSlotStart(slot({ weekday: 5, startTime: '19:30' }), 'Europe/Minsk', WED_NOON)).toBe(
      '2026-11-06T19:30',
    )
    expect(nextSlotStart(slot({ weekday: 1 }), 'Europe/Minsk', WED_NOON)).toBe('2026-11-09T20:00')
  })

  it('uses today when the slot time has not passed yet, otherwise next week', () => {
    expect(nextSlotStart(slot({ weekday: 3, startTime: '20:00' }), 'Europe/Minsk', WED_NOON)).toBe(
      '2026-11-04T20:00',
    )
    expect(nextSlotStart(slot({ weekday: 3, startTime: '12:00' }), 'Europe/Minsk', WED_NOON)).toBe(
      '2026-11-11T12:00',
    )
    expect(nextSlotStart(slot({ weekday: 3, startTime: '11:59' }), 'Europe/Minsk', WED_NOON)).toBe(
      '2026-11-11T11:59',
    )
  })

  it('takes the group day, not the UTC day, around midnight', () => {
    // 21:30 UTC среды = 00:30 четверга в Минске
    const lateWed = new Date('2026-11-04T21:30:00Z')
    expect(nextSlotStart(slot({ weekday: 4, startTime: '00:45' }), 'Europe/Minsk', lateWed)).toBe(
      '2026-11-05T00:45',
    )
    expect(nextSlotStart(slot({ weekday: 3, startTime: '10:00' }), 'Europe/Minsk', lateWed)).toBe(
      '2026-11-11T10:00',
    )
  })

  it('crosses month and year ends', () => {
    const newYear = new Date('2026-12-30T09:00:00Z') // среда
    expect(nextSlotStart(slot({ weekday: 5, startTime: '19:30' }), 'Europe/Minsk', newYear)).toBe(
      '2027-01-01T19:30',
    )
  })
})

describe('slot labels', () => {
  it('names the weekday and shows the venue, marking an archived one', () => {
    expect(weekdayShort(7)).toBe('Вс')
    expect(slotLabel(slot())).toBe('Пн 20:00 · Основа')
    expect(slotLabel(slot({ venueId: 4, venueName: 'Школа №24' }))).toBe(
      'Пн 20:00 · Основа · Школа №24',
    )
    expect(slotLabel(slot({ venueId: 4, venueName: 'Школа №24', venueArchived: true }))).toBe(
      'Пн 20:00 · Основа · Школа №24 (архив)',
    )
  })
})

const values = (over: Partial<SlotFormValues> = {}): SlotFormValues => ({
  weekday: 1,
  startTime: '20:00',
  title: 'Основа',
  type: 'training',
  durationMinutes: 120,
  capacity: '12',
  venueId: '',
  ...over,
})

describe('slot form validation', () => {
  it('accepts the boundary values', () => {
    expect(
      validateSlotForm(values({ startTime: '00:00', capacity: '1', durationMinutes: 15 })),
    ).toEqual({})
    expect(
      validateSlotForm(values({ startTime: '23:59', capacity: '500', durationMinutes: 1440 })),
    ).toEqual({})
    expect(validateSlotForm(values({ title: 'Ab' }))).toEqual({})
    expect(validateSlotForm(values({ title: 'x'.repeat(200) }))).toEqual({})
  })

  it('rejects values outside the boundaries', () => {
    expect(validateSlotForm(values({ startTime: '' })).startTime).toBeTruthy()
    expect(validateSlotForm(values({ startTime: '24:00' })).startTime).toBeTruthy()
    expect(validateSlotForm(values({ startTime: '20:60' })).startTime).toBeTruthy()
    expect(validateSlotForm(values({ title: ' a ' })).title).toBeTruthy()
    expect(validateSlotForm(values({ title: 'x'.repeat(201) })).title).toBeTruthy()
    for (const capacity of ['0', '501', '', '1.5', '-2', 'abc'])
      expect(validateSlotForm(values({ capacity })).capacity, capacity).toBeTruthy()
    expect(validateSlotForm(values({ durationMinutes: 14 })).durationMinutes).toBeTruthy()
    expect(validateSlotForm(values({ durationMinutes: 1441 })).durationMinutes).toBeTruthy()
  })
})

describe('slot request body', () => {
  it('trims the title and converts numbers and the empty venue', () => {
    expect(slotRequestBody(values({ title: '  Микст ', capacity: '14', venueId: '' }))).toEqual({
      weekday: 1,
      startTime: '20:00',
      title: 'Микст',
      type: 'training',
      durationMinutes: 120,
      capacity: 14,
      venueId: null,
    })
    expect(slotRequestBody(values({ venueId: '7' })).venueId).toBe(7)
  })
})
