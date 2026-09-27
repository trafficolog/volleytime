import { toMajor, toMinor } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import { canMutateDesktopPlan, desktopPlanState } from './desktop-plans'

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
