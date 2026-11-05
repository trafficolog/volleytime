import { toMajor, toMinor } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  canMutateDesktopPlan,
  desktopPlanState,
  planCaption,
  planPerSession,
  planValidityLabel,
} from './desktop-plans'

describe('desktop plan controls', () => {
  it('preserves existing plans but hides mutation when subscriptions are disabled or unknown', () => {
    const plans = [{ id: 9, name: '8 занятий' }]
    expect(desktopPlanState(false, plans)).toEqual({ showCreate: false, plans })
    expect(desktopPlanState(null, plans).showCreate).toBe(false)
    expect(desktopPlanState(true, plans).showCreate).toBe(true)
    expect(desktopPlanState(false, plans).plans[0]?.id).toBe(9)
  })

  it('requires a live route, enabled organization and an idle mutation', () => {
    const expected = '/app/orgs/7/plans'
    expect(canMutateDesktopPlan(expected, expected, true, false)).toBe(true)
    expect(canMutateDesktopPlan('/app/orgs/8/plans', expected, true, false)).toBe(false)
    expect(canMutateDesktopPlan(expected, expected, false, false)).toBe(false)
    expect(canMutateDesktopPlan(expected, expected, true, true)).toBe(false)
    expect(toMinor(toMajor(2500))).toBe(2500)
  })
})

describe('desktop plan card captions', () => {
  it('computes the per-session price in minor units and hides it for free plans', () => {
    expect(planPerSession(11000, 8)).toBe(1375)
    expect(planPerSession(10000, 3)).toBe(3333)
    expect(planPerSession(0, 8)).toBeNull()
    expect(planPerSession(5000, 0)).toBeNull()
  })

  it('describes validity and the per-session price', () => {
    expect(planValidityLabel(45)).toBe('45 дн.')
    expect(planValidityLabel(null)).toBe('бессрочно')
    expect(planCaption({ price: 11000, totalSessions: 8, validityDays: 45, currency: 'BYN' })).toBe(
      '13,75 BYN/занятие · 45 дн.',
    )
    expect(planCaption({ price: 0, totalSessions: 8, validityDays: null, currency: 'BYN' })).toBe(
      'бессрочно',
    )
  })
})
