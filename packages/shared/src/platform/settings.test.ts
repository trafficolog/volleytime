import { describe, expect, it } from 'vitest'

import {
  BOT_SETTINGS_DEFAULTS,
  BotSettingsResponseSchema,
  isPlatformSettingKey,
  minskToday,
  parsePlatformSetting,
  platformSettingDefaults,
  unlimitedBoundary,
  unlimitedLastDay,
  type PlatformSettingKey,
} from './settings'

const ok = (key: PlatformSettingKey, value: unknown) => parsePlatformSetting(key, value).ok

describe('platform settings registry', () => {
  it('defaults equal the behaviour before 22.3.1', () => {
    expect(platformSettingDefaults()).toEqual({
      'general.platformName': 'Volley Time',
      'general.supportContact': null,
      'eventBalance.newOrganizationGrant': 5,
      'events.maxPublishedPerDay': null,
      'bot.callbackLimit': 8,
      'bot.callbackWindowSeconds': 10,
    })
    expect(BOT_SETTINGS_DEFAULTS).toEqual({
      'bot.callbackLimit': 8,
      'bot.callbackWindowSeconds': 10,
    })
  })

  it('knows only registry keys', () => {
    expect(isPlatformSettingKey('bot.callbackLimit')).toBe(true)
    expect(isPlatformSettingKey('toString')).toBe(false)
    expect(isPlatformSettingKey('smtp.password')).toBe(false)
  })

  it.each([
    ['eventBalance.newOrganizationGrant', [1, 5, 1000], [0, 1001, 1.5, '5', null, -1, NaN]],
    ['events.maxPublishedPerDay', [null, 1, 50], [0, 51, 2.5, '1', -3]],
    ['bot.callbackLimit', [1, 8, 100], [0, 101, 1.1, '8', null]],
    ['bot.callbackWindowSeconds', [1, 10, 300], [0, 301, 0.5, '10', null]],
  ] as const)('%s accepts the bounds and rejects outside values', (key, good, bad) => {
    for (const v of good) expect(ok(key, v), `${key}=${String(v)}`).toBe(true)
    for (const v of bad) expect(ok(key, v), `${key}=${String(v)}`).toBe(false)
  })

  it('validates text values: trim, length, control characters', () => {
    expect(parsePlatformSetting('general.platformName', '  Volley  ')).toEqual({
      ok: true,
      value: 'Volley',
    })
    expect(ok('general.platformName', 'x'.repeat(60))).toBe(true)
    expect(ok('general.platformName', 'x'.repeat(61))).toBe(false)
    expect(ok('general.platformName', '   ')).toBe(false)
    expect(ok('general.platformName', null)).toBe(false)
    expect(ok('general.platformName', 'a\nb')).toBe(false)
    expect(ok('general.platformName', 'a\tb')).toBe(false)
    expect(ok('general.platformName', 'a\u007fb')).toBe(false)
    expect(ok('general.platformName', 'trailing\n')).toBe(false)
    expect(ok('general.supportContact', null)).toBe(true)
    expect(ok('general.supportContact', 'x'.repeat(120))).toBe(true)
    expect(ok('general.supportContact', 'x'.repeat(121))).toBe(false)
    expect(ok('general.supportContact', '')).toBe(false)
  })

  it('bot response schema accepts valid and rejects invalid payloads', () => {
    const good = { settings: { 'bot.callbackLimit': 3, 'bot.callbackWindowSeconds': 20 } }
    expect(BotSettingsResponseSchema.safeParse(good).success).toBe(true)
    for (const bad of [
      {},
      { settings: {} },
      { settings: { 'bot.callbackLimit': 0, 'bot.callbackWindowSeconds': 10 } },
      { settings: { 'bot.callbackLimit': '8', 'bot.callbackWindowSeconds': 10 } },
      { settings: { 'bot.callbackLimit': 8, 'bot.callbackWindowSeconds': 301 } },
    ])
      expect(BotSettingsResponseSchema.safeParse(bad).success).toBe(false)
  })
})

describe('unlimited boundary (Minsk, exclusive)', () => {
  it('last day D ends at D+1 00:00 Minsk = D 21:00Z', () => {
    expect(unlimitedBoundary('2026-12-31').toISOString()).toBe('2026-12-31T21:00:00.000Z')
    expect(unlimitedBoundary('2026-02-28').toISOString()).toBe('2026-02-28T21:00:00.000Z')
  })

  it('maps the boundary back to the last day', () => {
    expect(unlimitedLastDay(new Date('2026-12-31T21:00:00.000Z'))).toBe('2026-12-31')
    expect(unlimitedLastDay(new Date('2026-12-31T20:59:59.999Z'))).toBe('2026-12-31')
  })

  it('minskToday follows Minsk, not UTC', () => {
    expect(minskToday(new Date('2026-06-10T21:30:00Z'))).toBe('2026-06-11')
    expect(minskToday(new Date('2026-06-10T20:59:00Z'))).toBe('2026-06-10')
  })
})
