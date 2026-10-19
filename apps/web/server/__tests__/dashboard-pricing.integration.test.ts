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

  it('picks the nearest non-waitlisted booked game as hero even outside the first five published', async () => {
    const mk = (i: number, capacity = 5) =>
      eventService.create({ userId: ownerId }, orgId, {
        title: `Hero ${i}`,
        startsAt: new Date(Date.now() + (100 + i) * 3600_000),
        endsAt: new Date(Date.now() + (102 + i) * 3600_000),
        capacity,
        price: 0,
      })
    const full = await mk(0, 1)
    await bookingService.book({ userId: otherId }, orgId, full.id, { method: 'free' })
    const waitlisted = await bookingService.book({ userId: playerId }, orgId, full.id, {
      method: 'free',
    })
    expect(waitlisted.status).toBe('waitlisted')
    const rest = []
    for (let i = 1; i <= 6; i++) rest.push(await mk(i))
    const booked = rest[5]!
    await bookingService.book({ userId: playerId }, orgId, booked.id, { method: 'free' })

    const res = await request('GET', dashboard(), { user: playerId })
    const body = res.body as { hero: { id: number; myBooking: unknown; taken: number } | null }
    expect(
      (body as unknown as { upcoming: { id: number }[] }).upcoming.map((e) => e.id),
    ).not.toContain(booked.id)
    expect(body.hero).toMatchObject({ id: booked.id, taken: 1, myBooking: { status: 'confirmed' } })
    const none = await request('GET', dashboard(), { user: ownerId })
    expect((none.body as { hero: unknown }).hero).toBeNull()
  })

  it('gives a player without a going booking a null hero (none, or only a waitlist spot)', async () => {
    const full = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Full',
      startsAt: new Date(Date.now() + 120 * 3600_000),
      endsAt: new Date(Date.now() + 122 * 3600_000),
      capacity: 1,
      price: 0,
    })
    await bookingService.book({ userId: otherId }, orgId, full.id, { method: 'free' })
    expect(
      (await request('GET', dashboard(), { user: playerId })).body as { hero: unknown },
    ).toMatchObject({ hero: null })
    const waitlisted = await bookingService.book({ userId: playerId }, orgId, full.id, {
      method: 'free',
    })
    expect(waitlisted.status).toBe('waitlisted')
    const res = await request('GET', dashboard(), { user: playerId })
    expect(res.body).toMatchObject({ hero: null, bookingsCount: 1, bookingsAwaitingPayment: 0 })
  })

  it('keeps a settled split game awaiting payment as hero after registration closed', async () => {
    await bookingService.book({ userId: playerId }, orgId, eventId, { method: 'transfer' })
    await bookingService.book({ userId: otherId }, orgId, eventId, { method: 'cash' })
    await request('POST', `/api/organizations/${orgId}/events/${eventId}/settle`, { user: ownerId })
    const res = await request('GET', dashboard(), { user: playerId })
    const body = res.body as {
      hero: { id: number; status: string; pricing: { basis: string; myPaymentStatus: string } }
      bookingsAwaitingPayment: number
    }
    expect(body.hero).toMatchObject({
      id: eventId,
      pricing: { basis: 'settled', myPaymentStatus: 'pending' },
    })
    expect(body.hero.status).not.toBe('published')
    expect(body.bookingsAwaitingPayment).toBe(1)
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
  describe('price agreement with GET …/price (20.4.6, 20.4.4 follow-up)', () => {
    const priceOf = async (user: number, id = eventId) =>
      (
        (await request('GET', `/api/organizations/${orgId}/events/${id}/price`, { user })).body as {
          price: unknown
        }
      ).price
    type Item = { id: number; priceQuote?: unknown }
    const dash = async (user: number) =>
      (await request('GET', dashboard(), { user })).body as {
        hero: Item | null
        upcoming: Item[]
      }

    it('hero and schedule carry the same quote as GET …/price: forecast, before and after booking', async () => {
      const unbooked = await dash(playerId)
      expect(unbooked.hero).toBeNull()
      expect(unbooked.upcoming.find((e) => e.id === eventId)?.priceQuote).toEqual(
        await priceOf(playerId),
      )
      await bookingService.book({ userId: playerId }, orgId, eventId, { method: 'cash' })
      await bookingService.book({ userId: otherId }, orgId, eventId, { method: 'cash' })
      const booked = await dash(playerId)
      expect(booked.hero?.id).toBe(eventId)
      expect(booked.hero?.priceQuote).toEqual(await priceOf(playerId))
      expect(booked.upcoming.find((e) => e.id === eventId)?.priceQuote).toEqual(
        await priceOf(playerId),
      )
      // другой игрок видит прогноз под себя: места игрока в расчёт входят одинаково
      expect((await dash(otherId)).hero?.priceQuote).toEqual(await priceOf(otherId))
    })

    it('hero carries the settled quote with the own share after the registration is closed', async () => {
      await bookingService.book({ userId: playerId }, orgId, eventId, { method: 'transfer' })
      await bookingService.book({ userId: otherId }, orgId, eventId, { method: 'cash' })
      await bookingService.book({ userId: ownerId }, orgId, eventId, { method: 'cash' })
      await request('POST', `/api/organizations/${orgId}/events/${eventId}/settle`, {
        user: ownerId,
      })
      const quote = (await dash(playerId)).hero?.priceQuote as { basis: string; total: unknown }
      expect(quote).toEqual(await priceOf(playerId))
      expect(quote.basis).toBe('settled')
    })

    it('has no quote for fixed events and for managers', async () => {
      const fixed = await eventService.create({ userId: ownerId }, orgId, {
        title: 'Fixed',
        startsAt: new Date(Date.now() + 2 * 86400000),
        endsAt: new Date(Date.now() + 2 * 86400000 + 7200000),
        capacity: 5,
        price: 1500,
      })
      const player = await dash(playerId)
      expect(player.upcoming.find((e) => e.id === fixed.id)?.priceQuote ?? null).toBeNull()
      const manager = await dash(ownerId)
      expect(manager.upcoming.every((e) => (e.priceQuote ?? null) === null)).toBe(true)
    })
  })
})
