import { organizationService } from '@volley-time/core'
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

import { createTestApi } from './harness'

/** Task 20.1.1: GET /events/{id}/price?seats=N — единый расчёт цены места (P-03, D-01). */
describe('event price API (20.1.1)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let orgId: number
  let players: number[]

  const event = (o: Record<string, unknown> = {}) => ({
    title: 'Price',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 93600000).toISOString(),
    capacity: 4,
    priceMode: 'split',
    targetAmount: 10000,
    ...o,
  })
  const create = async (o: Record<string, unknown> = {}) => {
    const res = await request('POST', `/api/organizations/${orgId}/events`, {
      user: ownerId,
      body: event(o),
    })
    expect(res.status).toBe(200)
    return (res.body as { event: { id: number } }).event.id
  }
  const price = (eventId: number, user: number, query = '') =>
    request('GET', `/api/organizations/${orgId}/events/${eventId}/price${query}`, { user })
  const quote = async (eventId: number, user: number, query = '') => {
    const res = await price(eventId, user, query)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body as { price: Record<string, unknown> }).price
  }
  const book = async (eventId: number, user: number, method = 'cash') => {
    const res = await request('POST', `/api/organizations/${orgId}/events/${eventId}/bookings`, {
      user,
      body: { method },
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body as { booking: { id: number } }).booking.id
  }
  const eventView = async (eventId: number, user: number) =>
    (
      (await request('GET', `/api/organizations/${orgId}/events/${eventId}`, { user })).body as {
        event: { pricing: { minAmount: number; maxAmount: number; myAllocatedAmount: number } }
      }
    ).event.pricing

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    const people = await db
      .insert(users)
      .values(
        Array.from({ length: 6 }, (_, i) => ({ email: `price-${crypto.randomUUID()}-${i}@t.by` })),
      )
      .returning()
    ownerId = people[0]!.id
    players = people.slice(1).map((p) => p.id)
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Price API' })).id
    await db.insert(organizationMembers).values(
      players.map((userId) => ({
        userId,
        organizationId: orgId,
        role: 'player' as const,
        status: 'active' as const,
      })),
    )
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations).where(eq(organizations.id, orgId))
  })
  afterAll(async () => {
    await closeDb()
  })

  it('fixed: price × player seats, subscription applicable, same per-seat price as the event view', async () => {
    const eventId = await create({ priceMode: 'fixed', price: 1500, targetAmount: null })
    expect(await quote(eventId, players[0]!, '?seats=3')).toEqual({
      mode: 'fixed',
      basis: 'fixed',
      seats: 3,
      perSeat: { min: 1500, max: 1500 },
      total: { min: 4500, max: 4500 },
      seatCount: null,
      targetAmount: null,
      subscriptionApplicable: true,
      currency: 'BYN',
    })
    expect(await quote(eventId, players[0]!)).toMatchObject({ seats: 1, total: { min: 1500 } })
    expect((await eventView(eventId, players[0]!)).minAmount).toBe(1500)
  })

  it('fixed: subscription is not applicable when the group switched subscriptions off', async () => {
    await db
      .update(organizations)
      .set({ subscriptionsEnabled: false })
      .where(eq(organizations.id, orgId))
    const eventId = await create({ priceMode: 'fixed', price: 1500, targetAmount: null })
    expect(await quote(eventId, players[0]!)).toMatchObject({ subscriptionApplicable: false })
  })

  it('split forecast for 0, 1, current and max booked; matches the event view at the current roster', async () => {
    const eventId = await create()
    // 0 записавшихся: от полного состава до «я один»
    expect(await quote(eventId, players[0]!)).toMatchObject({
      basis: 'forecast',
      perSeat: { min: 2500, max: 10000 },
      seatCount: { current: 1, max: 4 },
      subscriptionApplicable: false,
    })
    await book(eventId, players[0]!)
    expect(await quote(eventId, players[0]!)).toMatchObject({
      perSeat: { min: 2500, max: 10000 },
      seatCount: { current: 1, max: 4 },
    })
    await book(eventId, players[1]!)
    await book(eventId, players[2]!)
    const current = await quote(eventId, players[0]!)
    expect(current).toMatchObject({
      perSeat: { min: 2500, max: 3334 },
      seatCount: { current: 3, max: 4 },
    })
    // Сверяется только perSeat.max уже записавшегося игрока (N ≥ 1 записавшихся, места по умолчанию)
    // с maxAmount представления GET /events/{id} (readEventPricing) для игрока и организатора.
    // Единый источник цены на экранах — критерий 20.4.6, 20.5.6, 20.6.1 (решение владельца 2026-10-14).
    expect((current.perSeat as { max: number }).max).toBe(
      (await eventView(eventId, players[0]!)).maxAmount,
    )
    expect((current.perSeat as { max: number }).max).toBe(
      (await eventView(eventId, ownerId)).maxAmount,
    )
    // игрок не записан: его места добавляются к текущему составу
    expect(await quote(eventId, players[3]!)).toMatchObject({
      perSeat: { min: 2500, max: 2500 },
      seatCount: { current: 4, max: 4 },
    })
    await book(eventId, players[3]!)
    expect(await quote(eventId, players[0]!)).toMatchObject({
      perSeat: { min: 2500, max: 2500 },
      seatCount: { current: 4, max: 4 },
    })
  })

  it('several seats for one player: total covers N seats of the split', async () => {
    const eventId = await create({ targetAmount: 10001, capacity: 5 })
    await book(eventId, players[0]!)
    expect(await quote(eventId, players[1]!, '?seats=2')).toMatchObject({
      seats: 2,
      perSeat: { min: 2000, max: 3334 },
      total: { min: 4000, max: 6668 },
      seatCount: { current: 3, max: 5 },
    })
  })

  it('last-minute cancellation recalculates the forecast; settlement fixes exact shares (D-01)', async () => {
    const eventId = await create({ targetAmount: 10001 })
    const ids = []
    for (const p of players.slice(0, 4)) ids.push(await book(eventId, p))
    expect(await quote(eventId, players[0]!)).toMatchObject({ perSeat: { min: 2500, max: 2501 } })
    const cancelled = await request(
      'POST',
      `/api/organizations/${orgId}/bookings/${ids[3]}/cancel`,
      { user: players[3]!, body: {} },
    )
    expect(cancelled.status).toBe(200)
    expect(await quote(eventId, players[0]!)).toMatchObject({ perSeat: { min: 2500, max: 3334 } })

    const settled = await request('POST', `/api/organizations/${orgId}/events/${eventId}/settle`, {
      user: ownerId,
      body: {},
    })
    expect(settled.status).toBe(200)
    const rows = await db.select().from(bookings).where(eq(bookings.eventId, eventId))
    const shares = rows.filter((b) => b.allocatedAmount !== null)
    expect(shares.reduce((sum, b) => sum + b.allocatedAmount!, 0)).toBe(10001)
    for (const b of shares) {
      const own = await quote(eventId, b.userId)
      expect(own).toMatchObject({
        basis: 'settled',
        total: { min: b.allocatedAmount, max: b.allocatedAmount },
        seatCount: { current: 3, max: 3 },
      })
      expect((await eventView(eventId, b.userId)).myAllocatedAmount).toBe(b.allocatedAmount)
    }
    // после фиксации цена не меняется: отмена организатором не пересчитывает доли
    await request('POST', `/api/organizations/${orgId}/bookings/${shares[0]!.id}/cancel`, {
      user: ownerId,
      body: {},
    })
    expect(await quote(eventId, shares[1]!.userId)).toMatchObject({
      total: { min: shares[1]!.allocatedAmount, max: shares[1]!.allocatedAmount },
      seatCount: { current: 3, max: 3 },
    })
    expect(await quote(eventId, players[4]!)).toMatchObject({
      basis: 'settled',
      perSeat: { min: 3333, max: 3334 },
    })
  })

  it('split never accepts a subscription booking (P-03)', async () => {
    const eventId = await create()
    const res = await request('POST', `/api/organizations/${orgId}/events/${eventId}/bookings`, {
      user: players[0]!,
      body: { method: 'subscription' },
    })
    expect(res.status).toBe(422)
    expect(res.body).toMatchObject({ data: { code: 'booking.method_not_allowed' } })
  })

  it.each(['?seats=0', '?seats=-1', '?seats=1.5', '?seats=abc', '?seats=11'])(
    'rejects malformed seats %s with 422 validation_failed',
    async (query) => {
      const eventId = await create()
      const res = await price(eventId, players[0]!, query)
      expect(res.status).toBe(422)
      expect(res.body).toMatchObject({ data: { code: 'validation_failed' } })
    },
  )

  it('rejects seats above the group limit or the event capacity', async () => {
    const eventId = await create({ capacity: 2 })
    for (const query of ['?seats=4', '?seats=3']) {
      const res = await price(eventId, players[0]!, query)
      expect(res.status).toBe(422)
      expect(res.body).toMatchObject({ data: { code: 'booking.seats_over_limit' } })
    }
  })

  it('hides drafts from players and events of other groups (404)', async () => {
    const draft = await create({ status: 'draft' })
    expect((await price(draft, players[0]!)).status).toBe(404)
    expect((await price(draft, ownerId)).status).toBe(200)
    const otherOwner = (
      await db
        .insert(users)
        .values({ email: `price-other-${crypto.randomUUID()}@t.by` })
        .returning()
    )[0]!.id
    const other = await organizationService.create({ userId: otherOwner }, { name: 'Other' })
    const foreign = await request('POST', `/api/organizations/${other.id}/events`, {
      user: otherOwner,
      body: event(),
    })
    const foreignId = (foreign.body as { event: { id: number } }).event.id
    const res = await price(foreignId, ownerId)
    expect(res.status).toBe(404)
    expect(JSON.stringify(res.body)).not.toContain('10000')
    await db.delete(organizations).where(eq(organizations.id, other.id))
  })
})
