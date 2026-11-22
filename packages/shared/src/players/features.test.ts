import { describe, expect, it } from 'vitest'

import {
  defaultPlayerFeatures,
  featureForNotificationKind,
  PLAYER_FEATURES,
  resolvePlayerFeatures,
} from './features'

describe('player features (23.1.1, P-12)', () => {
  it('has the eight flags of the spec, all on by default', () => {
    expect([...PLAYER_FEATURES]).toEqual([
      'cal',
      'coach',
      'warmup',
      'self',
      'mvp',
      'teams',
      'streak',
      'wrapped',
    ])
    const defaults = defaultPlayerFeatures()
    expect(Object.keys(defaults)).toEqual([...PLAYER_FEATURES])
    expect(Object.values(defaults).every((v) => v === true)).toBe(true)
  })

  it('resolves explicit choices over defaults and ignores unknown keys', () => {
    expect(resolvePlayerFeatures([{ feature: 'cal', enabled: false }]).cal).toBe(false)
    expect(resolvePlayerFeatures([{ feature: 'cal', enabled: false }]).mvp).toBe(true)
    expect(resolvePlayerFeatures([{ feature: 'nope', enabled: false }])).toEqual(
      defaultPlayerFeatures(),
    )
  })

  it('maps notification kinds to flags (D-23); other kinds have no flag', () => {
    expect(featureForNotificationKind('reminder_24h')).toBe('cal')
    expect(featureForNotificationKind('reminder_2h')).toBe('cal')
    expect(featureForNotificationKind('lineup_ready')).toBe('teams')
    expect(featureForNotificationKind('mvp_vote')).toBe('mvp')
    for (const kind of ['waitlist_offer', 'payment_confirmed', 'event_cancelled', 'booking_opened'])
      expect(featureForNotificationKind(kind)).toBeNull()
  })
})
