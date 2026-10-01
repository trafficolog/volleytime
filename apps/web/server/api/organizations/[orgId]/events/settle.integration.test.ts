import { bookingService, eventService, organizationService } from '@volley-time/core'
import {
  bookings,
  closeDb,
  db,
  eq,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from '../../../../__tests__/harness'

describe('split settlement and pricing HTTP projections', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let playerId: number
  let orgId: number
  let eventId: number
  const route = () => `/api/organizations/${orgId}/events/${eventId}`
  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([{ email: 'http-owner@test.by' }, { email: 'http-player@test.by' }])
      .returning()
    ownerId = people[0]!.id
    playerId = people[1]!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'HTTP pricing' })).id
    await db
      .insert(organizationMembers)
      .values({ userId: playerId, organizationId: orgId, role: 'player', status: 'active' })
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    eventId = (
      await eventService.create({ userId: ownerId }, orgId, {
        title: 'Split',
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        capacity: 3,
        priceMode: 'split',
        targetAmount: 10000,
      })
    ).id
  })
  afterEach(() => vi.unstubAllEnvs())
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it.each(['cancelled', 'waitlisted'] as const)(
    'pricing permissions include %s-only history with zero taken; stale mutation is rejected',
    async (status) => {
      const fresh = await request('GET', route(), { user: ownerId })
      expect(fresh.body).toMatchObject({
        event: {
          taken: 0,
          pricingPermissions: {
            canChangePriceMode: true,
            canChangeTargetAmount: true,
            canSettle: true,
          },
          pricing: { basis: 'capacity', participantCount: 3, minAmount: 3333, maxAmount: 3334 },
        },
      })
      await db
        .insert(bookings)
        .values({ organizationId: orgId, eventId, userId: playerId, method: 'cash', status })
      const response = await request('GET', route(), { user: ownerId })
      expect(response.body).toMatchObject({
        event: {
          taken: 0,
          pricingPermissions: {
            canChangePriceMode: false,
            canChangeTargetAmount: true,
            canSettle: true,
          },
        },
      })
      expect(
        (
          await request('PATCH', route(), {
            user: ownerId,
            body: { priceMode: 'fixed', targetAmount: null },
          })
        ).status,
      ).toBe(409)
    },
  )
  it('settles through guarded HTTP; returns only own money and no manager projection to player', async () => {
    await bookingService.book({ userId: playerId }, orgId, eventId, { method: 'transfer' })
    expect((await request('POST', `${route()}/settle`, { user: playerId })).status).toBe(403)
    const result = await request('POST', `${route()}/settle`, { user: ownerId })
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      event: { status: 'closed' },
      summary: { targetAmount: 10000, participantCount: 1, minAmount: 10000, maxAmount: 10000 },
    })
    expect((await request('POST', `${route()}/settle`, { user: ownerId })).body).toEqual(
      result.body,
    )
    expect((await request('GET', route(), { user: ownerId })).body).toMatchObject({
      event: {
        pricingPermissions: {
          canChangePriceMode: false,
          canChangeTargetAmount: false,
          canSettle: false,
        },
        pricingFinancials: {
          collected: 0,
          pending: 10000,
          cancelled: 0,
          refunded: 0,
          currency: 'BYN',
        },
        pricing: { myAllocatedAmount: null, myPaymentStatus: null },
      },
    })
    const player = (await request('GET', route(), { user: playerId })).body as {
      event: Record<string, unknown>
      roster: unknown[]
    }
    expect(player.event).toMatchObject({
      pricing: { myAllocatedAmount: 10000, myPaymentStatus: 'pending', basis: 'settled' },
    })
    expect(player.event).not.toHaveProperty('pricingPermissions')
    expect(player.event).not.toHaveProperty('pricingFinancials')
    expect(player.roster).toEqual([
      { user: { id: playerId, name: null, telegramUsername: null, image: null }, paid: false },
    ])
    expect(
      (await request('GET', `/api/organizations/${orgId}/events`, { user: playerId })).body,
    ).toMatchObject({
      events: [{ pricing: { myAllocatedAmount: 10000, myPaymentStatus: 'pending' } }],
    })
    expect(
      (await request('GET', `/api/organizations/${orgId}/bookings/my`, { user: playerId })).body,
    ).toMatchObject({
      bookings: [{ pricing: { myAllocatedAmount: 10000, myPaymentStatus: 'pending' } }],
    })
    expect(
      (await request('PATCH', route(), { user: ownerId, body: { status: 'published' } })).status,
    ).toBe(409)
  })
  it('denies foreign tenant, inactive member and fixed settlement; capability does not disable existing split', async () => {
    const foreign = (await organizationService.create({ userId: ownerId }, { name: 'Foreign' })).id
    expect(
      (await request('GET', `/api/organizations/${foreign}/events/${eventId}`, { user: ownerId }))
        .status,
    ).toBe(404)
    expect(
      (
        await request('POST', `/api/organizations/${foreign}/events/${eventId}/settle`, {
          user: ownerId,
        })
      ).status,
    ).toBe(404)
    await db
      .update(organizationMembers)
      .set({ status: 'blocked' })
      .where(eq(organizationMembers.userId, playerId))
    expect((await request('GET', route(), { user: playerId })).status).toBe(403)
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'false')
    expect((await request('GET', route(), { user: ownerId })).body).toMatchObject({
      event: { pricingPermissions: { canChangeTargetAmount: true, canSettle: true } },
    })
    await bookingService.book({ userId: ownerId }, orgId, eventId, { method: 'cash' })
    expect((await request('POST', `${route()}/settle`, { user: ownerId })).status).toBe(200)
    const fixed = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Fixed',
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      capacity: 3,
      price: 1000,
    })
    expect(
      (
        await request('POST', `/api/organizations/${orgId}/events/${fixed.id}/settle`, {
          user: ownerId,
        })
      ).status,
    ).toBe(409)
  })
  it('draft and cancelled states project existing edit policy; low target preview is provisional', async () => {
    await eventService.update({ userId: ownerId }, eventId, { targetAmount: 1, status: 'draft' })
    expect((await request('GET', route(), { user: ownerId })).body).toMatchObject({
      event: {
        pricingPermissions: {
          canChangePriceMode: true,
          canChangeTargetAmount: true,
          canSettle: false,
        },
        pricing: { basis: 'capacity', minAmount: 0, maxAmount: 1 },
      },
    })
    await eventService.cancel({ userId: ownerId }, eventId)
    expect((await request('GET', route(), { user: ownerId })).body).toMatchObject({
      event: {
        pricingPermissions: {
          canChangePriceMode: false,
          canChangeTargetAmount: false,
          canSettle: false,
        },
      },
    })
    expect(
      (await request('PATCH', route(), { user: ownerId, body: { targetAmount: 20 } })).status,
    ).toBe(409)
  })
})
