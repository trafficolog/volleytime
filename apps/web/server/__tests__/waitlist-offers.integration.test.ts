import { bookingService, eventService, memberService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, organizations, users, waitlistOffers } from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

/**
 * Task 20.3.1: HTTP-контракт предложения места из листа ожидания и времени открытия записи —
 * принять своё предложение (200), чужое в своей группе (404), истёкшее (410); событие с будущим
 * временом открытия отвечает на запись 422 `booking.not_open_yet`; карточка события показывает
 * игроку его активное предложение.
 */
describe('waitlist offers and booking opening over HTTP (20.3.1)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let orgId: number
  let people: number[]
  const base = () => `/api/organizations/${orgId}`

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    vi.stubEnv('SCHEDULER_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    const rows = await db
      .insert(users)
      .values(Array.from({ length: 4 }, (_, i) => ({ email: `wo-${i}-${Math.random()}@t.by` })))
      .returning()
    ownerId = rows[0]!.id
    people = rows.slice(1).map((u) => u.id)
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Offers' })).id
    for (const userId of people)
      await memberService.add({ userId: ownerId }, { organizationId: orgId, userId })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('accepts own offer, hides other players offers and refuses expired ones', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Full',
      startsAt: new Date(Date.now() + 48 * 3600_000),
      endsAt: new Date(Date.now() + 50 * 3600_000),
      capacity: 1,
    })
    const [a, b, c] = people as [number, number, number]
    const ba = await bookingService.book({ userId: a }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: b }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: c }, orgId, ev.id, { method: 'free' })
    await bookingService.cancel({ userId: a }, ba.id)
    const [offer] = await db.select().from(waitlistOffers).where(eq(waitlistOffers.eventId, ev.id))

    const card = await request('GET', `${base()}/events/${ev.id}`, { user: b })
    expect(card.status).toBe(200)
    expect(JSON.stringify(card.body)).toContain(`"offer":{"id":${offer!.id}`)

    const url = `${base()}/waitlist-offers/${offer!.id}/accept`
    const foreign = await request('POST', url, { user: c, body: {} })
    expect(foreign.status).toBe(404)
    expect((foreign.body as { data: { code: string } }).data.code).toBe('waitlist_offer.not_found')

    const ok = await request('POST', url, { user: b, body: {} })
    expect(ok.status).toBe(200)
    expect((ok.body as { booking: { status: string } }).booking.status).toBe('confirmed')

    await db
      .update(waitlistOffers)
      .set({
        status: 'offered',
        offeredAt: new Date(Date.now() - 3600_000),
        expiresAt: new Date(Date.now() - 1),
      })
      .where(eq(waitlistOffers.id, offer!.id))
    const expired = await request('POST', url, { user: b, body: {} })
    expect(expired.status).toBe(410)
    expect((expired.body as { data: { code: string } }).data.code).toBe('waitlist_offer.expired')
  })

  // 20.4.11: игрок видит свою позицию и размер очереди, но не чужие записи и личности
  it('gives a player only their own queue position and the aggregate queue size', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Queue',
      startsAt: new Date(Date.now() + 48 * 3600_000),
      endsAt: new Date(Date.now() + 50 * 3600_000),
      capacity: 1,
    })
    const [a, b, c] = people as [number, number, number]
    await db.update(users).set({ name: 'Mainov' }).where(eq(users.id, a))
    await db.update(users).set({ name: 'Waitnik-Bravo' }).where(eq(users.id, b))
    await db.update(users).set({ name: 'Waitnik-Charlie' }).where(eq(users.id, c))
    const ba = await bookingService.book({ userId: a }, orgId, ev.id, { method: 'free' })
    const bb = await bookingService.book({ userId: b }, orgId, ev.id, { method: 'free' })
    const bc = await bookingService.book({ userId: c }, orgId, ev.id, { method: 'free' })

    type Card = { event: { waitlist: number; myBooking: { id: number; waitPos: number | null } } }
    const card = await request('GET', `${base()}/events/${ev.id}`, { user: c })
    expect(card.status).toBe(200)
    expect((card.body as Card).event.waitlist).toBe(2)
    expect((card.body as Card).event.myBooking).toMatchObject({ id: bc.id, waitPos: 2 })
    for (const leak of ['Waitnik-Bravo', `"userId":${b}`])
      expect(JSON.stringify(card.body)).not.toContain(leak)
    expect(JSON.stringify(card.body)).not.toContain(`"id":${bb.id},`)

    const list = await request('GET', `${base()}/events`, { user: b })
    const row = (list.body as { events: Array<{ id: number } & Card['event']> }).events.find(
      (e) => e.id === ev.id,
    )
    expect(row?.myBooking).toMatchObject({ id: bb.id, waitPos: 1 })

    const mine = await request('GET', `${base()}/bookings/my`, { user: c })
    const bookingsBody = (mine.body as { bookings: Array<{ id: number; waitPos: number | null }> })
      .bookings
    expect(bookingsBody.map((x) => [x.id, x.waitPos])).toEqual([[bc.id, 2]])
    expect(JSON.stringify(mine.body)).not.toContain('Waitnik-Bravo')

    // игрок в основе позиции не имеет
    const main = await request('GET', `${base()}/events/${ev.id}`, { user: a })
    expect((main.body as Card).event.myBooking).toMatchObject({ id: ba.id, waitPos: null })
  })

  it('rejects booking before the opening time with 422 booking.not_open_yet', async () => {
    const org = await request('GET', base(), { user: ownerId })
    expect((org.body as { capabilities: object }).capabilities).toMatchObject({
      eventScheduler: true,
    })
    const created = await request('POST', `${base()}/events`, {
      user: ownerId,
      body: {
        title: 'Later',
        startsAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
        endsAt: new Date(Date.now() + 50 * 3600_000).toISOString(),
        capacity: 5,
        bookingOpensAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
      },
    })
    expect(created.status).toBe(200)
    const eventId = (created.body as { event: { id: number } }).event.id
    const res = await request('POST', `${base()}/events/${eventId}/bookings`, {
      user: people[0],
      body: { method: 'free' },
    })
    expect(res.status).toBe(422)
    expect((res.body as { data: { code: string } }).data.code).toBe('booking.not_open_yet')

    vi.stubEnv('SCHEDULER_ENABLED', '')
    const disabled = await request('PATCH', `${base()}/events/${eventId}`, {
      user: ownerId,
      body: { bookingOpensAt: new Date(Date.now() + 30 * 3600_000).toISOString() },
    })
    expect(disabled.status).toBe(409)
    expect((disabled.body as { data: { code: string } }).data.code).toBe('event.scheduler_disabled')
  })
})
