import { PLAYER_FEATURES } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import { FEATURE_LABELS, featureRowView, SUPPRESSED_TEXT } from './root-features'

describe('root-features', () => {
  it('has a label for every player feature', () => {
    for (const f of PLAYER_FEATURES) expect(FEATURE_LABELS[f]).toBeTruthy()
  })

  it('never reveals size or value of a suppressed cohort', () => {
    const hidden = { players: null, value: null, suppressed: true }
    const view = featureRowView({
      feature: 'cal',
      disabledShare: hidden,
      weeklyActive: hidden,
      retention: hidden,
      bookingFrequency: { on: hidden, off: hidden },
    })
    for (const c of [
      view.disabledShare,
      view.weeklyActive,
      view.retention,
      view.frequencyOn,
      view.frequencyOff,
    ]) {
      expect(c).toEqual({ suppressed: true, text: SUPPRESSED_TEXT, cohort: '' })
    }
  })

  it('formats shares as percent, frequency with one decimal and a null value as a dash', () => {
    const view = featureRowView({
      feature: 'mvp',
      disabledShare: { players: 21, value: 0.333, suppressed: false },
      weeklyActive: { players: 1, value: 1, suppressed: false },
      retention: { players: 10, value: null, suppressed: false },
      bookingFrequency: {
        on: { players: 11, value: 1.25, suppressed: false },
        off: { players: 10, value: 0, suppressed: false },
      },
    })
    expect(view.label).toBe('MVP игры')
    expect(view.disabledShare.text).toMatch(/^33\s?%$/)
    expect(view.disabledShare.cohort).toBe('21 игрок')
    expect(view.weeklyActive.cohort).toBe('1 игрок')
    expect(view.retention.text).toBe('—')
    expect(view.frequencyOn.text).toBe('1,3')
    expect(view.frequencyOff.text).toBe('0')
  })
})
