import { describe, expect, it } from 'vitest'

import {
  WIZARD_DEFAULTS,
  buildWizardSeries,
  validateGroupName,
  validateSchedule,
  wizardStartDate,
} from './org-wizard'

describe('validateGroupName', () => {
  it('requires at least 2 characters after trim', () => {
    expect(validateGroupName('  ')).toBe('Название — минимум 2 символа')
    expect(validateGroupName(' a ')).toBe('Название — минимум 2 символа')
    expect(validateGroupName(' Ср ')).toBe('')
  })
})

describe('validateSchedule', () => {
  it('needs a day, a valid time and seats in 1..500', () => {
    const ok = { days: [3], time: '20:00', seats: '14' }
    expect(validateSchedule(ok)).toEqual({ days: '', time: '', seats: '' })
    expect(validateSchedule({ ...ok, days: [] }).days).not.toBe('')
    expect(validateSchedule({ ...ok, time: '25:00' }).time).not.toBe('')
    expect(validateSchedule({ ...ok, time: '' }).time).not.toBe('')
    expect(validateSchedule({ ...ok, seats: '0' }).seats).not.toBe('')
    expect(validateSchedule({ ...ok, seats: '501' }).seats).not.toBe('')
    expect(validateSchedule({ ...ok, seats: '1.5' }).seats).not.toBe('')
  })
})

describe('wizardStartDate', () => {
  it('is tomorrow in the group time zone', () => {
    // 22:30 UTC 4 Nov = 01:30 5 Nov in Minsk (UTC+3) -> start 6 Nov
    expect(wizardStartDate(new Date('2026-11-04T22:30:00Z'), 'Europe/Minsk')).toBe('2026-11-06')
    expect(wizardStartDate(new Date('2026-11-04T12:00:00Z'), 'Europe/Minsk')).toBe('2026-11-05')
    expect(wizardStartDate(new Date('2026-12-31T22:00:00Z'), 'Europe/Minsk')).toBe('2027-01-02')
  })
})

describe('buildWizardSeries', () => {
  it('maps the wizard fields to the series contract with engineering defaults (21.1.7)', () => {
    const body = buildWizardSeries({
      name: '  Волейбол по средам ',
      days: [5, 3],
      time: '19:30',
      seats: '12',
      startDate: '2026-11-06',
    })
    expect(body).toEqual({
      rule: { freq: 'weekly', weekdays: [3, 5], startDate: '2026-11-06', until: '2026-12-05' },
      exceptions: [],
      template: {
        type: 'training',
        title: 'Волейбол по средам',
        startTime: '19:30',
        durationMinutes: 120,
        capacity: 12,
      },
    })
  })

  it('has defaults matching the prototype', () => {
    expect(WIZARD_DEFAULTS).toMatchObject({ time: '20:00', seats: '14', days: [3] })
  })
})
