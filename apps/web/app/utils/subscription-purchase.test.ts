import { describe, expect, it } from 'vitest'

import { runSubscriptionPurchase } from './subscription-purchase'

const plan = { id: 7, organizationId: 1, status: 'active' }

describe('subscription purchase', () => {
  it('does not POST when the organization disabled subscriptions after the sheet opened', async () => {
    let calls = 0
    const result = await runSubscriptionPurchase(
      { orgId: 1, allowPurchase: false, buying: false, plan },
      'cash',
      async () => {
        calls++
      },
      () => true,
      () => {},
    )

    expect(result).toEqual({ kind: 'blocked' })
    expect(calls).toBe(0)
  })

  it('keeps a pending purchase and its selected plan after server rejection', async () => {
    let selectedPlan: number | null = 7
    const pending = ['awaiting payment']
    const result = await runSubscriptionPurchase(
      { orgId: 1, allowPurchase: true, buying: false, plan },
      'transfer',
      async () => {
        throw new Error('subscriptions disabled on server')
      },
      () => true,
      () => {
        selectedPlan = null
        pending.length = 0
      },
    )

    expect(result.kind).toBe('error')
    expect(selectedPlan).toBe(7)
    expect(pending).toEqual(['awaiting payment'])
  })

  it('commits only a current successful POST with the chosen plan and method', async () => {
    let sent: { orgId: number; planId: number; method: string } | null = null
    let closed = false
    const result = await runSubscriptionPurchase(
      { orgId: 1, allowPurchase: true, buying: false, plan },
      'cash',
      async (orgId, planId, method) => {
        sent = { orgId, planId, method }
      },
      () => true,
      () => {
        closed = true
      },
    )

    expect(result).toEqual({ kind: 'success' })
    expect(sent).toEqual({ orgId: 1, planId: 7, method: 'cash' })
    expect(closed).toBe(true)
  })
})
