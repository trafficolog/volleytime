import {
  eventService,
  memberService,
  organizationService,
  planService,
  subscriptionService,
} from '@volley-time/core'
import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

describe('organization subscription toggle (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let playerId: number
  let orgId: number

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [owner] = await db
      .insert(users)
      .values({ email: `toggle-owner-${Math.random()}@t.by` })
      .returning()
    const [player] = await db
      .insert(users)
      .values({ email: `toggle-player-${Math.random()}@t.by` })
      .returning()
    ownerId = owner!.id
    playerId = player!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Toggle HTTP' })).id
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: playerId })
  })

  it('rejects new subscription writes but keeps old balance readable and cash usable', async () => {
    const plan = await planService.create(
      { userId: ownerId },
      {
        organizationId: orgId,
        name: 'Existing',
        totalSessions: 4,
        price: 4000,
      },
    )
    const sub = await subscriptionService.createFromPlan({ userId: playerId }, orgId, plan.id, {
      autoActivate: true,
    })
    const event = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Paid event',
      startsAt: new Date(Date.now() + 24 * 3600_000),
      endsAt: new Date(Date.now() + 26 * 3600_000),
      capacity: 2,
      price: 1500,
    })
    expect(
      (
        await request('PATCH', `/api/organizations/${orgId}`, {
          user: ownerId,
          body: { subscriptionsEnabled: false },
        })
      ).status,
    ).toBe(200)
    const denied = [
      await request('POST', `/api/organizations/${orgId}/plans`, {
        user: ownerId,
        body: { name: 'Another', totalSessions: 4, price: 4000 },
      }),
      await request('POST', `/api/organizations/${orgId}/subscriptions`, {
        user: playerId,
        body: { planId: plan.id, method: 'cash' },
      }),
      await request('POST', `/api/organizations/${orgId}/events/${event.id}/bookings`, {
        user: playerId,
        body: { method: 'subscription', subscriptionId: sub.id },
      }),
    ]
    for (const response of denied) {
      expect(response.status).toBe(409)
      expect(response.body).toMatchObject({ data: { code: 'organization.subscriptions_disabled' } })
    }
    expect(
      (
        await request('GET', `/api/organizations/${orgId}/subscriptions/my`, {
          user: playerId,
        })
      ).body,
    ).toMatchObject({ subscriptions: [expect.objectContaining({ id: sub.id })] })
    expect(
      (
        await request('POST', `/api/organizations/${orgId}/events/${event.id}/bookings`, {
          user: playerId,
          body: { method: 'cash' },
        })
      ).status,
    ).toBe(200)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
