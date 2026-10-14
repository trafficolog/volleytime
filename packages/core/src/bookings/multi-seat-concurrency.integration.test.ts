import { bookings, closeDb, db, eq, organizations, payments, sql, users } from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { bookingService } from './service'

/**
 * Task 20.1.2: параллельные операции с местами не превышают вместимость (advisory-lock события,
 * SUM(seats) под локом) и не теряют денежный инвариант «живые платежи = seats».
 */
describe('multi-seat concurrency (20.1.2, PostgreSQL)', () => {
  let ownerId: number
  let orgId: number
  const future = (h = 24) => new Date(Date.now() + h * 3600_000)

  async function players(n: number): Promise<number[]> {
    const rows = await db
      .insert(users)
      .values(Array.from({ length: n }, () => ({ email: `mc-${Math.random()}@t.by` })))
      .returning()
    for (const u of rows)
      await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u.id })
    return rows.map((u) => u.id)
  }

  const makeEvent = (capacity: number, price = 1000) =>
    eventService.create({ userId: ownerId }, orgId, {
      title: 'Гонка',
      startsAt: future(),
      endsAt: future(26),
      capacity,
      price,
    })

  async function occupancy(eventId: number) {
    const [row] = await db
      .select({
        taken: sql<number>`coalesce(sum(${bookings.seats}) FILTER (WHERE ${bookings.status} IN ('confirmed','pending_payment')), 0)::int`,
        queued: sql<number>`coalesce(sum(CASE WHEN ${bookings.status} = 'waitlisted' THEN ${bookings.seats} ELSE ${bookings.waitlistSeats} END), 0)::int`,
      })
      .from(bookings)
      .where(eq(bookings.eventId, eventId))
    return row!
  }

  /** Каждая платная запись в основе держит ровно seats живых платежей. */
  async function moneyDrift(eventId: number) {
    return db.execute(sql`
      SELECT b.id FROM bookings b
      WHERE b.event_id = ${eventId} AND b.status IN ('confirmed', 'pending_payment')
        AND b.seats <> (
          SELECT count(*) FROM payments p
          WHERE p.booking_id = b.id AND p.booking_incarnation = b.incarnation
            AND p.seat_released_at IS NULL AND p.status IN ('pending', 'succeeded'))`)
  }

  beforeEach(async () => {
    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Race' })).id
    await db.update(organizations).set({ maxSeatsPerBooking: 4 }).where(eq(organizations.id, orgId))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('parallel multi-seat bookings without queue consent never overbook', async () => {
    const ev = await makeEvent(10)
    const ids = await players(8)
    const results = await Promise.allSettled(
      ids.map((userId) =>
        bookingService.book({ userId }, orgId, ev.id, { method: 'cash', seats: 3 }),
      ),
    )
    const ok = results.filter((r) => r.status === 'fulfilled')
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    // 3 записи по 3 места в основу (9), дальше 1 свободное место → 409 без согласия на очередь
    expect(ok).toHaveLength(3)
    expect(failed.map((r) => r.reason.code)).toEqual(Array(5).fill('booking.not_enough_seats'))
    expect(await occupancy(ev.id)).toEqual({ taken: 9, queued: 0 })
    expect((await moneyDrift(ev.id)).length).toBe(0)
    expect(await db.select().from(payments)).toHaveLength(9)
  })

  it('parallel bookings with queue consent fill capacity exactly and queue the rest', async () => {
    const ev = await makeEvent(10, 0)
    const ids = await players(6)
    await Promise.all(
      ids.map((userId) =>
        bookingService.book({ userId }, orgId, ev.id, {
          method: 'free',
          seats: 4,
          allowWaitlist: true,
        }),
      ),
    )
    expect(await occupancy(ev.id)).toEqual({ taken: 10, queued: 14 })
  })

  it('parallel partial cancels, increases and new bookings keep capacity and money invariants', async () => {
    const ev = await makeEvent(8)
    const [a, b, c, d, e] = await players(5)
    const ba = await bookingService.book({ userId: a! }, orgId, ev.id, { method: 'cash', seats: 4 })
    const bb = await bookingService.book({ userId: b! }, orgId, ev.id, { method: 'cash', seats: 3 })
    await paymentService.confirm({ userId: ownerId }, ba.paymentId!, { orgId })
    await bookingService.book({ userId: c! }, orgId, ev.id, {
      method: 'cash',
      seats: 3,
      allowWaitlist: true,
    })

    const [shrink, grow, plain, consent, cancel] = await Promise.allSettled([
      bookingService.changeSeats({ userId: a! }, ba.id, { seats: 1 }),
      bookingService.changeSeats({ userId: b! }, bb.id, { seats: 4 }),
      bookingService.book({ userId: d! }, orgId, ev.id, { method: 'cash', seats: 2 }),
      bookingService.book({ userId: e! }, orgId, ev.id, {
        method: 'transfer',
        seats: 2,
        allowWaitlist: true,
      }),
      bookingService.cancel({ userId: b! }, bb.id),
    ])
    const code = (r: PromiseSettledResult<unknown>) =>
      r.status === 'fulfilled' ? 'ok' : (r.reason as { code?: string }).code
    // уменьшение, запись с согласием на очередь и отмена проходят при любом порядке
    expect([code(shrink), code(consent), code(cancel)]).toEqual(['ok', 'ok', 'ok'])
    // увеличение зависит от порядка: свободных мест нет или запись уже отменена
    expect(['ok', 'booking.not_enough_seats', 'booking.not_cancellable']).toContain(code(grow))
    // запись без согласия: в основу, целиком в очередь или 409 при частичной нехватке
    expect(['ok', 'booking.not_enough_seats']).toContain(code(plain))
    expect(await db.query.bookings.findFirst({ where: eq(bookings.id, ba.id) })).toMatchObject({
      seats: 1,
    })
    expect(await db.query.bookings.findFirst({ where: eq(bookings.id, bb.id) })).toMatchObject({
      status: 'cancelled',
      waitlistSeats: 0,
    })
    const { taken } = await occupancy(ev.id)
    expect(taken).toBeLessThanOrEqual(8)
    expect((await moneyDrift(ev.id)).length).toBe(0)
    // место свободно, только если очередь пуста (освобождённые места уходят очереди)
    const { queued } = await occupancy(ev.id)
    if (queued > 0) expect(taken).toBe(8)
  })
})
