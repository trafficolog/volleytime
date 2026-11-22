import { describe, expect, it } from 'vitest'

import { cohortMetric, FEATURE_ANALYTICS_MIN_COHORT, FeatureEventInput } from './feature-analytics'

describe('feature analytics contract (23.1.2, D-25)', () => {
  it('accepts the eight features and two kinds only', () => {
    expect(FeatureEventInput.parse({ feature: 'cal', kind: 'open' })).toEqual({
      feature: 'cal',
      kind: 'open',
    })
    expect(FeatureEventInput.safeParse({ feature: 'wrapped', kind: 'use' }).success).toBe(true)
    expect(FeatureEventInput.safeParse({ feature: 'booking', kind: 'open' }).success).toBe(false)
    expect(FeatureEventInput.safeParse({ feature: 'cal', kind: 'click' }).success).toBe(false)
    expect(FeatureEventInput.safeParse({ feature: 'cal', kind: 'open', userId: 1 }).success).toBe(
      false,
    )
  })

  it('suppresses cohorts under the threshold', () => {
    expect(FEATURE_ANALYTICS_MIN_COHORT).toBe(10)
    expect(cohortMetric(9, 0.5)).toEqual({ players: null, value: null, suppressed: true })
    expect(cohortMetric(0, null)).toEqual({ players: null, value: null, suppressed: true })
    expect(cohortMetric(10, 0.3)).toEqual({ players: 10, value: 0.3, suppressed: false })
  })
})
