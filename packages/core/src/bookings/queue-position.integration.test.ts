import {
  bookings,
  closeDb,
  db,
  eq,
  organizations,
  users,
  waitlistOffers,
  type Booking,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

import { expireOffersLocked, OFFER_TTL_MS } from './offers'
import { bookingService } from './service'

/**
 * Task 20.4.11: позиция игрока в очереди события. Правило одно с планировщиком: очередь —
 * записи `waitlisted` и записи в основе с `waitlist_seats > 0`, порядок `(booked_at, id)`; место
 * предлагается (или продвигается) тому, кто стоит первым без предложения. Игрок видит только свою
 * позицию — чужих записей и личностей в ответах нет.
 */
describe('waitlist position (20.4.11, PostgreSQL)', { timeout: 60_000 }, () => {
  let ownerId: number
  let orgId: number

  async function player(): Promise<number> {
    const [u] = await db
      .insert(users)
      .values({ email: `qp-${crypto.randomUUID()}@t.by`, name: `Игрок ${Math.random()}` })
      .returning()
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
    return u!.id
  }

  const makeEvent = (capacity: number) =>
    eventService.create({ userId: ownerId }, orgId, {
      title: 'Игра',
      startsAt: new Date(Date.now() + 48 * 3600_000),
      endsAt: new Date(Date.now() + 50 * 3600_000),
      capacity,
      price: 0,
    })

  /** Позиция игрока, как её видит он сам: карточка события и «Мои записи». */
  async function posOf(userId: number, eventId: number): Promise<number | null> {
    const stats = (await eventService.statsFor({ userId }, [eventId])).get(eventId)!
    const mine = (await bookingService.listMyBookings({ userId }, orgId, 'all')).find(
      (b) => b.eventId === eventId,
    )
    // оба ответа обязаны согласоваться
    expect(mine?.waitPos ?? null).toBe(stats.myBooking?.waitPos ?? null)
    return stats.myBooking?.waitPos ?? null
  }

  const reload = async (id: number): Promise<Booking> =>
    (await db.query.bookings.findFirst({ where: eq(bookings.id, id) }))!

  beforeEach(async () => {
    vi.stubEnv('SCHEDULER_ENABLED', '')
    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `qp-owner-${crypto.randomUUID()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Queue' })).id
  })
  afterEach(() => vi.unstubAllEnvs())
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('numbers the queue in booking order and gives no position outside the queue', async () => {
    const ev = await makeEvent(1)
    const [main, w1, w2, w3] = [await player(), await player(), await player(), await player()]
    await bookingService.book({ userId: main }, orgId, ev.id, { method: 'free' })
    for (const p of [w1, w2, w3])
      await bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' })
    expect(await posOf(main, ev.id)).toBeNull()
    expect(await posOf(w1, ev.id)).toBe(1)
    expect(await posOf(w2, ev.id)).toBe(2)
    expect(await posOf(w3, ev.id)).toBe(3)
    expect(await posOf(await player(), ev.id)).toBeNull()
  })

  it('moves everyone up when someone ahead cancels', async () => {
    const ev = await makeEvent(1)
    const [main, w1, w2, w3] = [await player(), await player(), await player(), await player()]
    await bookingService.book({ userId: main }, orgId, ev.id, { method: 'free' })
    const b1 = await bookingService.book({ userId: w1 }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: w2 }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: w3 }, orgId, ev.id, { method: 'free' })
    await bookingService.cancel({ userId: w1 }, b1.id)
    expect(await posOf(w2, ev.id)).toBe(1)
    expect(await posOf(w3, ev.id)).toBe(2)
    expect(await posOf(w1, ev.id)).toBeNull()
  })

  it('breaks booked_at ties by booking id, as the scheduler does', async () => {
    const ev = await makeEvent(1)
    const [main, w1, w2] = [await player(), await player(), await player()]
    await bookingService.book({ userId: main }, orgId, ev.id, { method: 'free' })
    const b1 = await bookingService.book({ userId: w1 }, orgId, ev.id, { method: 'free' })
    const b2 = await bookingService.book({ userId: w2 }, orgId, ev.id, { method: 'free' })
    const same = new Date(Date.now() - 60_000)
    await db.update(bookings).set({ bookedAt: same }).where(eq(bookings.eventId, ev.id))
    expect(b1.id).toBeLessThan(b2.id)
    expect(await posOf(w1, ev.id)).toBe(1)
    expect(await posOf(w2, ev.id)).toBe(2)
  })

  it('is the order the server promotes in when the scheduler is off (cancel of a main seat)', async () => {
    const ev = await makeEvent(2)
    const main = [await player(), await player()]
    const queue = [await player(), await player(), await player()]
    const mainBookings: Booking[] = []
    for (const p of main)
      mainBookings.push(await bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' }))
    for (const p of queue)
      await bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' })

    // каждый раз продвигается тот, у кого сейчас позиция 1
    for (let step = 0; step < queue.length; step++) {
      const positions = await Promise.all(queue.map((p) => posOf(p, ev.id)))
      const first = queue[positions.indexOf(1)]!
      const holder = mainBookings[step % 2]!
      const live = await reload(holder.id)
      await bookingService.cancel({ userId: live.userId }, live.id)
      const promoted = await db.query.bookings.findFirst({
        where: eq(bookings.userId, first),
      })
      expect(promoted?.status, `step ${step}`).toBe('confirmed')
      mainBookings[step % 2] = promoted!
    }
  })

  it('is the order the scheduler offers seats in (D-03), including expiry', async () => {
    vi.stubEnv('SCHEDULER_ENABLED', 'true')
    const ev = await makeEvent(1)
    const main = await player()
    const queue = [await player(), await player(), await player()]
    const mainBooking = await bookingService.book({ userId: main }, orgId, ev.id, {
      method: 'free',
    })
    for (const p of queue)
      await bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' })
    expect(await Promise.all(queue.map((p) => posOf(p, ev.id)))).toEqual([1, 2, 3])

    await bookingService.cancel({ userId: main }, mainBooking.id)
    const offers = await db.select().from(waitlistOffers).where(eq(waitlistOffers.eventId, ev.id))
    expect(offers).toHaveLength(1)
    const offered = await reload(offers[0]!.bookingId)
    expect(offered.userId).toBe(queue[0])
    // предложение держит позицию 1 и отдаёт срок (D-03); остальные не сдвигаются
    const stats = (await eventService.statsFor({ userId: queue[0]! }, [ev.id])).get(ev.id)!
    expect(stats.myBooking).toMatchObject({ waitPos: 1 })
    expect(stats.myBooking?.offer?.expiresAt).toEqual(offers[0]!.expiresAt)
    expect(await posOf(queue[1]!, ev.id)).toBe(2)

    // не ответил за 30 мин → покидает очередь, следующий становится первым и получает предложение
    const later = new Date(offers[0]!.offeredAt.getTime() + OFFER_TTL_MS + 1000)
    await db.transaction(async (tx) => {
      await expireOffersLocked({ userId: ownerId, db: tx }, ev.id, later)
    })
    expect(await posOf(queue[0]!, ev.id)).toBeNull()
    expect(await posOf(queue[1]!, ev.id)).toBe(1)
    expect(await posOf(queue[2]!, ev.id)).toBe(2)
  })

  it('does not count an expired, not yet processed offer ahead: that player is leaving the queue', async () => {
    vi.stubEnv('SCHEDULER_ENABLED', 'true')
    const ev = await makeEvent(1)
    const main = await player()
    const [q1, q2] = [await player(), await player()]
    const mainBooking = await bookingService.book({ userId: main }, orgId, ev.id, {
      method: 'free',
    })
    await bookingService.book({ userId: q1 }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: q2 }, orgId, ev.id, { method: 'free' })
    await bookingService.cancel({ userId: main }, mainBooking.id)
    await db
      .update(waitlistOffers)
      .set({ offeredAt: new Date(Date.now() - 3600_000), expiresAt: new Date(Date.now() - 1000) })
      .where(eq(waitlistOffers.eventId, ev.id))
    expect(await posOf(q2, ev.id)).toBe(1)
  })

  it('counts a main booking with queued seats once, at its own place in the queue', async () => {
    const ev = await makeEvent(2)
    const [a, b, c] = [await player(), await player(), await player()]
    // a занимает 1 место и 1 оставляет в очереди; b и c — целиком в очереди
    await bookingService.book({ userId: b }, orgId, ev.id, { method: 'free', seats: 1 })
    const partial = await bookingService.book({ userId: a }, orgId, ev.id, {
      method: 'free',
      seats: 2,
      allowWaitlist: true,
    })
    expect(partial).toMatchObject({ status: 'confirmed', seats: 1, waitlistSeats: 1 })
    await bookingService.book({ userId: c }, orgId, ev.id, { method: 'free', seats: 1 })
    expect(await posOf(a, ev.id)).toBe(1)
    expect(await posOf(c, ev.id)).toBe(2)
    expect(await posOf(b, ev.id)).toBeNull()
  })

  it('shows a player only their own booking and the aggregate queue size', async () => {
    const ev = await makeEvent(1)
    const [main, w1, w2] = [await player(), await player(), await player()]
    await bookingService.book({ userId: main }, orgId, ev.id, { method: 'free' })
    const b1 = await bookingService.book({ userId: w1 }, orgId, ev.id, { method: 'free' })
    const b2 = await bookingService.book({ userId: w2 }, orgId, ev.id, { method: 'free' })

    const stats = (await eventService.statsFor({ userId: w2 }, [ev.id])).get(ev.id)!
    expect(stats.waitlist).toBe(2) // агрегат
    expect(stats.myBooking?.id).toBe(b2.id)
    expect(JSON.stringify(stats)).not.toContain(`"userId":${w1}`)
    expect(JSON.stringify(stats)).not.toContain(`"id":${b1.id},`)

    const mine = await bookingService.listMyBookings({ userId: w2 }, orgId, 'all')
    expect(mine.map((b) => b.id)).toEqual([b2.id])
  })
})
