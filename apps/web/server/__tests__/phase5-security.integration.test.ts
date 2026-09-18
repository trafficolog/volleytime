import {
  bookingService,
  eventService,
  memberService,
  organizationService,
  planService,
  subscriptionService,
} from '@volley-time/core'
import {
  bookings,
  closeDb,
  db,
  eq,
  events as eventsTable,
  organizations,
  subscriptions,
  users,
} from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/** Находки ревью Phase 5 через HTTP-слой (5.13.x). */
describe('Phase 5 API security (integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerA: number, ownerB: number, player: number
  let orgA: number, orgB: number

  const newUser = async (name: string) =>
    (
      await db
        .insert(users)
        .values({
          email: `${name}-${Math.random()}@t.by`,
          name,
          phone: '+375000',
          telegramUserId: BigInt(Math.floor(Math.random() * 1e9)),
        })
        .returning()
    )[0]!.id
  const future = (h: number) => new Date(Date.now() + h * 3600_000)

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerA = await newUser('ownerA')
    ownerB = await newUser('ownerB')
    player = await newUser('player')
    orgA = (await organizationService.create({ userId: ownerA }, { name: 'Org A' })).id
    orgB = (await organizationService.create({ userId: ownerB }, { name: 'Org B' })).id
    await memberService.add({ userId: ownerA }, { organizationId: orgA, userId: player })
    await memberService.add({ userId: ownerB }, { organizationId: orgB, userId: player })
  })

  const makeEvent = (orgId: number, owner: number, extra: Record<string, unknown> = {}) =>
    eventService.create({ userId: owner }, orgId, {
      title: 'Тренировка',
      startsAt: future(24),
      endsAt: future(26),
      capacity: 10,
      price: 0,
      ...extra,
    })

  it('5.13.2/5.13.3: roster of own event — 200 without private fields; foreign event — 404', async () => {
    const ev = await makeEvent(orgA, ownerA)
    await bookingService.book({ userId: player }, orgA, ev.id, { method: 'free' })
    const own = await request('GET', `/api/organizations/${orgA}/events/${ev.id}/bookings`, {
      user: ownerA,
    })
    expect(own.status).toBe(200)
    expect(own.text).not.toMatch(/email|phone|telegramUserId|isRootAdmin|@t\.by|\+375/)
    const foreign = await request('GET', `/api/organizations/${orgB}/events/${ev.id}/bookings`, {
      user: ownerB,
    })
    expect(foreign.status).toBe(404)
  })

  it('5.13.4: cannot mark attendance of another organization booking', async () => {
    const evA = await makeEvent(orgA, ownerA)
    const bA = await bookingService.book({ userId: player }, orgA, evA.id, { method: 'free' })
    const evB = await makeEvent(orgB, ownerB)
    const past = new Date(Date.now() - 3600_000)
    await db.update(eventsTable).set({ startsAt: past }).where(eq(eventsTable.id, evA.id))
    await db.update(eventsTable).set({ startsAt: past }).where(eq(eventsTable.id, evB.id))
    const r = await request('POST', `/api/organizations/${orgB}/events/${evB.id}/attendance`, {
      user: ownerB,
      body: { marks: [{ bookingId: bA.id, attended: false }] },
    })
    expect(r.status).toBe(404)
    const [row] = await db.select().from(bookings).where(eq(bookings.id, bA.id))
    expect(row!.status).toBe('confirmed')
  })

  it('5.13.5: subscription of org A cannot be consumed in org B; expired not consumed', async () => {
    const planA = await planService.create(
      { userId: ownerA },
      { organizationId: orgA, name: 'A-8', totalSessions: 8, price: 8000 },
    )
    const subA = await subscriptionService.createFromPlan({ userId: player }, orgA, planA.id, {
      autoActivate: true,
    })
    const evB = await makeEvent(orgB, ownerB, { price: 1500 })
    const r = await request('POST', `/api/organizations/${orgB}/events/${evB.id}/bookings`, {
      user: player,
      body: { method: 'subscription', subscriptionId: subA.id },
    })
    expect(r.status).toBe(409)
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, subA.id))
    expect(row!.usedSessions).toBe(0)

    await db
      .update(subscriptions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(subscriptions.id, subA.id))
    const evA = await makeEvent(orgA, ownerA, { price: 1500 })
    const expired = await request('POST', `/api/organizations/${orgA}/events/${evA.id}/bookings`, {
      user: player,
      body: { method: 'subscription', subscriptionId: subA.id },
    })
    expect(expired.status).toBe(409)
  })

  it('5.13.11: pending cannot book; drafts hidden from players; capacity ≥ taken; no past events', async () => {
    const pending = await newUser('pending')
    await memberService.add(
      { userId: ownerA },
      { organizationId: orgA, userId: pending, status: 'pending' },
    )
    const ev = await makeEvent(orgA, ownerA)
    const booked = await request('POST', `/api/organizations/${orgA}/events/${ev.id}/bookings`, {
      user: pending,
      body: { method: 'free' },
    })
    expect(booked.status).toBe(403)
    await expect(
      bookingService.book({ userId: pending }, orgA, ev.id, { method: 'free' }),
    ).rejects.toThrow(/pending/)

    await db.update(eventsTable).set({ status: 'draft' }).where(eq(eventsTable.id, ev.id))
    const list = await request('GET', `/api/organizations/${orgA}/events`, { user: player })
    expect((list.body as { events: { id: number }[] }).events.map((e) => e.id)).not.toContain(ev.id)
    expect(
      (await request('GET', `/api/organizations/${orgA}/events/${ev.id}`, { user: player })).status,
    ).toBe(404)
    const ownerList = await request('GET', `/api/organizations/${orgA}/events`, { user: ownerA })
    expect((ownerList.body as { events: { id: number }[] }).events.map((e) => e.id)).toContain(
      ev.id,
    )

    const small = await makeEvent(orgA, ownerA, { capacity: 3 })
    await bookingService.book({ userId: player }, orgA, small.id, { method: 'free' })
    await bookingService.book({ userId: ownerA }, orgA, small.id, { method: 'free' })
    const shrink = await request('PATCH', `/api/organizations/${orgA}/events/${small.id}`, {
      user: ownerA,
      body: { capacity: 1 },
    })
    expect(shrink.status).toBe(422)

    const past = await request('POST', `/api/organizations/${orgA}/events`, {
      user: ownerA,
      body: {
        title: 'Вчера',
        startsAt: new Date(Date.now() - 86400_000).toISOString(),
        endsAt: new Date(Date.now() - 82800_000).toISOString(),
        capacity: 10,
      },
    })
    expect(past.status).toBe(422)
  })

  it('5.13.17: events list returns taken/waitlist/myBooking', async () => {
    const ev = await makeEvent(orgA, ownerA, { capacity: 1 })
    await bookingService.book({ userId: ownerA }, orgA, ev.id, { method: 'free' })
    await bookingService.book({ userId: player }, orgA, ev.id, { method: 'free' })
    const r = await request('GET', `/api/organizations/${orgA}/events`, { user: player })
    const item = (r.body as { events: Record<string, unknown>[] }).events.find(
      (e) => e.id === ev.id,
    )!
    expect(item).toMatchObject({ taken: 1, waitlist: 1, myBooking: { status: 'waitlisted' } })
  })

  it('6.8.7: expense validation — fractional/negative/unknown category/foreign event rejected', async () => {
    const bad = [
      { category: 'rent', amount: 1.5 },
      { category: 'rent', amount: -100 },
      { category: 'hack', amount: 100 },
      {
        category: 'rent',
        amount: 100,
        occurredAt: new Date(Date.now() + 5 * 86400_000).toISOString(),
      },
    ]
    for (const body of bad) {
      const r = await request('POST', `/api/organizations/${orgA}/ledger/expense`, {
        user: ownerA,
        body,
      })
      expect(r.status).toBe(422)
    }
    const evB = await makeEvent(orgB, ownerB)
    const foreign = await request('POST', `/api/organizations/${orgA}/ledger/expense`, {
      user: ownerA,
      body: { category: 'rent', amount: 5000, eventId: evB.id },
    })
    expect(foreign.status).toBe(404)
    const ok = await request('POST', `/api/organizations/${orgA}/ledger/expense`, {
      user: ownerA,
      body: { category: 'rent', amount: 5000, description: 'Аренда зала' },
    })
    expect(ok.status).toBe(200)
  })

  it('8.8.3: /api/events/:id/locate — member gets orgId, outsider gets 404', async () => {
    const ev = await makeEvent(orgA, ownerA)
    const mine = await request('GET', `/api/events/${ev.id}/locate`, { user: player })
    expect(mine.status).toBe(200)
    expect((mine.body as { orgId: number }).orgId).toBe(orgA)
    const outsider = await request('GET', `/api/events/${ev.id}/locate`, { user: ownerB })
    expect(outsider.status).toBe(404)
    expect(outsider.text).not.toContain(String(orgA))
  })

  it('8.8.12: dashboard — player sees bookings, manager sees money', async () => {
    const ev = await makeEvent(orgA, ownerA, { price: 1500 })
    await bookingService.book({ userId: player }, orgA, ev.id, { method: 'cash' })
    const asPlayer = await request('GET', `/api/organizations/${orgA}/dashboard`, { user: player })
    expect(asPlayer.status).toBe(200)
    const pb = asPlayer.body as { isManager: boolean; myBookings: unknown[]; manager: unknown }
    expect(pb.isManager).toBe(false)
    expect(pb.myBookings).toHaveLength(1)
    expect(pb.manager).toBeNull()

    const asOwner = await request('GET', `/api/organizations/${orgA}/dashboard`, { user: ownerA })
    const ob = asOwner.body as {
      isManager: boolean
      manager: { pendingCount: number; pendingAmount: number; balance: { currency: string } }
      upcoming: { id: number; taken: number }[]
    }
    expect(ob.isManager).toBe(true)
    expect(ob.manager.pendingCount).toBe(1)
    expect(ob.manager.pendingAmount).toBe(1500)
    expect(ob.upcoming.find((e) => e.id === ev.id)?.taken).toBe(1)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
