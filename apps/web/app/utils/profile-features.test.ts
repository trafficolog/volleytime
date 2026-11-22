import { defaultPlayerFeatures, PLAYER_FEATURES } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import { enabledFeatureRows, featureRows, presetFlags, presetOf } from './profile-features'

const off = () => presetFlags('games')!

describe('profile features view', () => {
  it('lists eight features with labels and hints', () => {
    const rows = featureRows(defaultPlayerFeatures())
    expect(rows.map((r) => r.feature)).toEqual([...PLAYER_FEATURES])
    expect(rows.every((r) => r.label && r.hint && r.enabled)).toBe(true)
  })

  it('shows only enabled features in «Мои функции»', () => {
    const features = { ...off(), cal: true, mvp: true }
    expect(enabledFeatureRows(features).map((r) => r.feature)).toEqual(['cal', 'mvp'])
    expect(enabledFeatureRows(off())).toEqual([])
  })

  it('derives the preset from flags', () => {
    expect(presetOf(defaultPlayerFeatures())).toBe('all')
    expect(presetOf(off())).toBe('games')
    expect(presetOf({ ...off(), cal: true })).toBe('custom')
  })

  it('preset flags: games off, all on, custom unchanged', () => {
    expect(Object.values(presetFlags('games')!).every((v) => v === false)).toBe(true)
    expect(Object.values(presetFlags('all')!).every((v) => v === true)).toBe(true)
    expect(presetFlags('custom')).toBeNull()
  })
})
