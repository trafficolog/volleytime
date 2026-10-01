import { organizationService } from '@volley-time/core'
import { bookings, closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

describe('event pricing API contract (5.16.1)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let orgId: number
  const body = () => ({
    title: 'Split training',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 93600000).toISOString(),
    capacity: 4,
    priceMode: 'split',
    targetAmount: 10000,
  })
  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [owner] = await db
      .insert(users)
      .values({ email: `pricing-api-${Math.random()}@t.by` })
      .returning()
    ownerId = owner!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Pricing API' })).id
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
  })
  afterEach(() => vi.unstubAllEnvs())
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it.each([undefined, 'false', 'TRUE', 'true'])(
    'projects nonsensitive capability for flag %s',
    async (flag) => {
      vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', flag)
      const result = await request('GET', `/api/organizations/${orgId}`, { user: ownerId })
      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({ capabilities: { eventSplitPricing: flag === 'true' } })
    },
  )
  it('returns a domain conflict for disabled split creation', async () => {
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'false')
    const result = await request('POST', `/api/organizations/${orgId}/events`, {
      user: ownerId,
      body: body(),
    })
    expect(result.status).toBe(409)
    expect(result.body).toMatchObject({ data: { code: 'event.split_pricing_disabled' } })
  })
  it('rejects client settlement fields and direct closure through HTTP', async () => {
    const created = await request('POST', `/api/organizations/${orgId}/events`, {
      user: ownerId,
      body: body(),
    })
    expect(created.status).toBe(200)
    const eventId = (created.body as { event: { id: number } }).event.id
    const route = `/api/organizations/${orgId}/events/${eventId}`
    for (const data of [
      { pricingSettledAt: new Date() },
      { pricingParticipantCount: 2 },
      { allocatedAmount: 5000 },
    ]) {
      expect((await request('PATCH', route, { user: ownerId, body: data })).status).toBe(422)
      expect(
        (
          await request('POST', `/api/organizations/${orgId}/events`, {
            user: ownerId,
            body: { ...body(), ...data },
          })
        ).status,
      ).toBe(422)
    }
    const closed = await request('PATCH', route, { user: ownerId, body: { status: 'closed' } })
    expect(closed.status).toBe(409)
    expect(closed.body).toMatchObject({ data: { code: 'event.settlement_required' } })
  })
  it('returns a conflict for mode change after cancelled-only history', async () => {
    const created = await request('POST', `/api/organizations/${orgId}/events`, {
      user: ownerId,
      body: { ...body(), priceMode: 'fixed', targetAmount: null },
    })
    const eventId = (created.body as { event: { id: number } }).event.id
    await db.insert(bookings).values({
      eventId,
      userId: ownerId,
      organizationId: orgId,
      status: 'cancelled',
      method: 'free',
    })
    const result = await request('PATCH', `/api/organizations/${orgId}/events/${eventId}`, {
      user: ownerId,
      body: { priceMode: 'split', targetAmount: 10000 },
    })
    expect(result.status).toBe(409)
    expect(result.body).toMatchObject({ data: { code: 'event.pricing_locked' } })
  })
})
