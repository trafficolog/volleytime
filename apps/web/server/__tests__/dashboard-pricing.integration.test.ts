import { bookingService, eventService, organizationService } from '@volley-time/core'
import { closeDb, db, organizationMembers, organizations, users } from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

describe('dashboard pricing projection', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let playerId: number
  let otherId: number
  let orgId: number
  let eventId: number
  const dashboard = () => `/api/organizations/${orgId}/dashboard`
  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([
        { email: 'dash-owner@test.by' },
        { email: 'dash-player@test.by' },
        { email: 'dash-other@test.by' },
      ])
      .returning()
    ownerId = people[0]!.id
    playerId = people[1]!.id
    otherId = people[2]!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Dashboard pricing' }))
      .id
    await db.insert(organizationMembers).values(
      [playerId, otherId].map((userId) => ({
        userId,
        organizationId: orgId,
        role: 'player' as const,
        status: 'active' as const,
      })),
    )
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

  it('returns exact own booking counters beyond the preview limit and never another player count', async () => {
    const mk = (i: number, price: number) =>
      eventService.create({ userId: ownerId }, orgId, {
        title: `Fixed ${i}`,
        startsAt: new Date(Date.now() + (100 + i) * 3600_000),
        endsAt: new Date(Date.now() + (102 + i) * 3600_000),
        capacity: 5,
        price,
      })
    for (let i = 0; i < 5; i++) {
      const event = await mk(i, i === 0 ? 1500 : 0)
      await bookingService.book({ userId: playerId }, orgId, event.id, {
        method: i === 0 ? 'cash' : 'free',
      })
    }
    const mine = await request('GET', dashboard(), { user: playerId })
    expect(mine.body).toMatchObject({ bookingsCount: 5, bookingsAwaitingPayment: 1 })
    expect((mine.body as { myBookings: unknown[] }).myBookings).toHaveLength(3)
    const other = await request('GET', dashboard(), { user: otherId })
    expect(other.body).toMatchObject({ bookingsCount: 0, bookingsAwaitingPayment: 0 })
  })

  it('projects forecast and actual currency to Home; never exposes another player allocation', async () => {
    await bookingService.book({ userId: playerId }, orgId, eventId, { method: 'transfer' })
    const before = await request('GET', dashboard(), { user: playerId })
    expect(before.status).toBe(200)
    expect(before.body).toMatchObject({
      myBookings: [
        {
          pricing: { basis: 'current', myAllocatedAmount: null, myPaymentStatus: null },
          event: { currency: 'BYN' },
        },
      ],
      upcoming: [{ pricing: { basis: 'current', minAmount: 10000, maxAmount: 10000 } }],
    })
    await bookingService.book({ userId: otherId }, orgId, eventId, { method: 'cash' })
    await bookingService.book({ userId: ownerId }, orgId, eventId, { method: 'cash' })
    await request('POST', `/api/organizations/${orgId}/events/${eventId}/settle`, { user: ownerId })
    const settled = await request('GET', dashboard(), { user: playerId })
    expect(settled.body).toMatchObject({
      isManager: false,
      manager: null,
      myBookings: [
        {
          pricing: { basis: 'settled', myAllocatedAmount: 3334, myPaymentStatus: 'pending' },
          event: { id: eventId, currency: 'BYN' },
        },
      ],
    })
    const own = (settled.body as { myBookings: Record<string, unknown>[] }).myBookings[0]!
    expect(own).not.toHaveProperty('user')
    expect(own).not.toHaveProperty('pricingFinancials')
    expect(JSON.stringify(settled.body)).not.toContain('pricingPermissions')
    expect((await request('GET', dashboard())).status).toBe(401)
    const outsider = (
      await db.insert(users).values({ email: 'dash-outsider@test.by' }).returning()
    )[0]!
    expect((await request('GET', dashboard(), { user: outsider.id })).status).toBe(403)
  })
})
