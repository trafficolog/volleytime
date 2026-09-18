import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { closeDb, db } from '../index'

import { organizations } from './organizations'
import { subscriptionPlans } from './subscription-plans'
import { subscriptions } from './subscriptions'
import { users } from './users'

async function setup() {
  const [owner] = await db
    .insert(users)
    .values({ email: `o-${Math.random()}@t.by` })
    .returning()
  const [org] = await db
    .insert(organizations)
    .values({ slug: `s-${Math.random()}`.slice(0, 40), name: 'Org', ownerUserId: owner!.id })
    .returning()
  const [plan] = await db
    .insert(subscriptionPlans)
    .values({ organizationId: org!.id, name: 'P', totalSessions: 8 })
    .returning()
  return { owner: owner!, org: org!, plan: plan! }
}

describe('subscriptions schema (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })

  it('inserts with defaults', async () => {
    const { owner, org, plan } = await setup()
    const [sub] = await db
      .insert(subscriptions)
      .values({ organizationId: org.id, userId: owner.id, planId: plan.id, totalSessions: 8 })
      .returning()
    expect(sub?.status).toBe('pending')
    expect(sub?.usedSessions).toBe(0)
    expect(sub?.totalSessions).toBe(8)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
