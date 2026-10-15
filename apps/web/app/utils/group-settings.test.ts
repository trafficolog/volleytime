import { describe, expect, it } from 'vitest'

import {
  SETTING_IMPACT,
  SETTINGS_SECTIONS,
  cancellationHint,
  deadlineOptions,
  deadlineToValue,
  parseSection,
  seatsHint,
  settingsErrorMessage,
  settingsPatch,
  sortLevels,
  textOrNull,
  validateBookings,
  validateProfile,
  valueToDeadline,
  visibleSections,
  type GroupSettings,
} from './group-settings'

const base: GroupSettings = {
  subscriptionsEnabled: true,
  maxSeatsPerBooking: 3,
  defaultPriceMode: 'fixed',
  defaultJoinMode: 'open',
  cancellationAllowed: true,
  cancellationDeadlineHours: 6,
  seoIndex: false,
  city: 'Минск',
  district: null,
  levels: ['v2'],
}

describe('group settings sections', () => {
  it('hides the danger zone from non-owners and falls back to the profile', () => {
    expect(visibleSections(false).map((s) => s.key)).not.toContain('danger')
    expect(visibleSections(true).map((s) => s.key)).toContain('danger')
    expect(parseSection('danger', false)).toBe('profile')
    expect(parseSection('danger', true)).toBe('danger')
    expect(parseSection(['bookings'], true)).toBe('bookings')
    expect(parseSection('nope', true)).toBe('profile')
    expect(parseSection(undefined, true)).toBe('profile')
  })

  it('has an impact hint for every editable setting', () => {
    for (const key of [
      'name',
      'description',
      'city',
      'district',
      'seoIndex',
      'subscriptionsEnabled',
      'cancellationAllowed',
      'cancellationDeadlineHours',
      'maxSeatsPerBooking',
      'defaultPriceMode',
      'defaultJoinMode',
      'levels',
      'defaultMemberStatus',
    ] as const) {
      expect(SETTING_IMPACT[key].length).toBeGreaterThan(20)
    }
    expect(SETTINGS_SECTIONS).toHaveLength(7)
  })
})

describe('group settings validation', () => {
  it('limits seats to 1..10 and the cancel deadline to 0..720', () => {
    expect(validateBookings({ maxSeatsPerBooking: 3, cancellationDeadlineHours: null })).toEqual({})
    for (const maxSeatsPerBooking of [0, 11, 2.5]) {
      expect(validateBookings({ maxSeatsPerBooking, cancellationDeadlineHours: 6 })).toHaveProperty(
        'maxSeatsPerBooking',
      )
    }
    expect(
      validateBookings({ maxSeatsPerBooking: 3, cancellationDeadlineHours: 721 }),
    ).toHaveProperty('cancellationDeadlineHours')
    expect(validateBookings({ maxSeatsPerBooking: 3, cancellationDeadlineHours: 720 })).toEqual({})
  })

  it('mirrors the server text limits', () => {
    const ok = { name: 'Группа', description: '', city: '', district: '' }
    expect(validateProfile(ok)).toEqual({})
    expect(validateProfile({ ...ok, name: ' a ' })).toHaveProperty('name')
    expect(validateProfile({ ...ok, name: 'a'.repeat(101) })).toHaveProperty('name')
    expect(validateProfile({ ...ok, description: 'a'.repeat(501) })).toHaveProperty('description')
    expect(validateProfile({ ...ok, city: 'a'.repeat(101) })).toHaveProperty('city')
    expect(validateProfile({ ...ok, district: 'a'.repeat(101) })).toHaveProperty('district')
  })
})

describe('group settings helpers', () => {
  it('builds a patch with changed fields only', () => {
    expect(
      settingsPatch(base, { ...base, maxSeatsPerBooking: 4 }, [
        'maxSeatsPerBooking',
        'defaultJoinMode',
      ]),
    ).toEqual({ maxSeatsPerBooking: 4 })
    expect(settingsPatch(base, { ...base }, ['levels', 'city'])).toEqual({})
    expect(settingsPatch(base, { ...base, levels: ['v2', 'v3'] }, ['levels'])).toEqual({
      levels: ['v2', 'v3'],
    })
    expect(settingsPatch(base, { ...base, district: 'Центр' }, ['district'])).toEqual({
      district: 'Центр',
    })
  })

  it('maps the deadline between the select value and the API value', () => {
    expect(deadlineToValue(null)).toBe('any')
    expect(deadlineToValue(0)).toBe('any')
    expect(deadlineToValue(6)).toBe('6')
    expect(valueToDeadline('any')).toBeNull()
    expect(valueToDeadline('24')).toBe(24)
    expect(deadlineOptions(5).map((o) => o.value)).toEqual([
      'any',
      '1',
      '2',
      '5',
      '6',
      '12',
      '24',
      '48',
      '72',
    ])
    expect(deadlineOptions(6)).toHaveLength(8)
  })

  it('words the consequences of seats and cancellation', () => {
    expect(seatsHint(1)).toContain('приводить гостей нельзя')
    expect(seatsHint(3)).toContain('до 3 мест')
    expect(cancellationHint(false, 6)).toContain('не смогут')
    expect(cancellationHint(true, null)).toContain('до начала')
    expect(cancellationHint(true, 6)).toContain('6 ч')
  })

  it('normalizes text, levels and error messages', () => {
    expect(textOrNull('  ')).toBeNull()
    expect(textOrNull(' Центр ')).toBe('Центр')
    expect(sortLevels(['v4_plus', 'v1', 'v3'])).toEqual(['v1', 'v3', 'v4_plus'])
    expect(settingsErrorMessage(410, 'x')).toContain('архиве')
    expect(settingsErrorMessage(422, 'x')).toContain('Проверьте')
    expect(settingsErrorMessage(500, 'fallback')).toBe('fallback')
  })
})
