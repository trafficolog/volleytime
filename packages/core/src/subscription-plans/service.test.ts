import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

import { PlanNotFoundError } from './errors'
import { planService } from './service'

let ownerId: number
let orgId: number

describe('planService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `pl-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Plan Org' })
    orgId = org.id
  })

  it('creates a paid plan', async () => {
    const p = await planService.create(
      { userId: ownerId },
      {
        organizationId: orgId,
        name: '8 занятий',
        totalSessions: 8,
        validityDays: 60,
        price: 8000, // 80.00 BYN
      },
    )
    expect(p.totalSessions).toBe(8)
    expect(p.price).toBe(8000)
    expect(p.status).toBe('active')
  })

  it('creates a free plan (price 0)', async () => {
    const p = await planService.create(
      { userId: ownerId },
      {
        organizationId: orgId,
        name: 'Пробный',
        totalSessions: 1,
      },
    )
    expect(p.price).toBe(0)
  })

  it('rejects a new plan while subscriptions are off but retains existing plans', async () => {
    const existing = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Existing', totalSessions: 4, price: 4000 },
    )
    await organizationService.update({ userId: ownerId }, orgId, { subscriptionsEnabled: false })
    await expect(
      planService.create(
        { userId: ownerId },
        { organizationId: orgId, name: 'New', totalSessions: 4, price: 4000 },
      ),
    ).rejects.toMatchObject({ code: 'organization.subscriptions_disabled' })
    expect((await planService.listByOrg({ userId: ownerId }, orgId)).map((p) => p.id)).toContain(
      existing.id,
    )
  })

  it('lists active plans sorted by price', async () => {
    await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'План Б', totalSessions: 4, price: 5000 },
    )
    await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'План А', totalSessions: 8, price: 2000 },
    )
    const list = await planService.listByOrg({ userId: ownerId }, orgId)
    expect(list.map((p) => p.price)).toEqual([2000, 5000])
  })

  it('archive hides from default list', async () => {
    const p = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Old', totalSessions: 4 },
    )
    await planService.archive({ userId: ownerId }, p.id)
    const active = await planService.listByOrg({ userId: ownerId }, orgId)
    expect(active).toHaveLength(0)
    const all = await planService.listByOrg({ userId: ownerId }, orgId, true)
    expect(all).toHaveLength(1)
  })

  it('getById throws for missing', async () => {
    await expect(planService.getById({ userId: ownerId }, 99999)).rejects.toThrow(PlanNotFoundError)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
