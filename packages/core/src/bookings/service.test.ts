import { closeDb, db, eq, events, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { planService } from '../subscription-plans/service'
import { subscriptionService } from '../subscriptions/service'

import { AlreadyBookedError, BookingMethodNotAllowedError, EventNotBookableError } from './errors'
import { bookingService } from './service'

let ownerId: number
let orgId: number

const future = (h = 24) => new Date(Date.now() + h * 3600_000)
const futureEnd = (h = 26) => new Date(Date.now() + h * 3600_000)

async function newPlayer() {
  const [u] = await db
    .insert(users)
    .values({ email: `p-${Math.random()}@t.by` })
    .returning()
  await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
  return u!.id
}

async function makeEvent(opts: { capacity?: number; price?: number } = {}) {
  return eventService.create({ userId: ownerId }, orgId, {
    title: 'Тренировка',
    startsAt: future(),
    endsAt: futureEnd(),
    capacity: opts.capacity ?? 2,
    price: opts.price ?? 0,
  })
}

/** Сдвинуть начало события в прошлое (отметка посещаемости возможна после старта). */
async function startEvent(eventId: number) {
  await db
    .update(events)
    .set({ startsAt: new Date(Date.now() - 3600_000) })
    .where(eq(events.id, eventId))
}

describe('bookingService.book (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Booking Org' })
    orgId = org.id
  })

  it('free event → confirmed', async () => {
    const ev = await makeEvent({ price: 0 })
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    expect(b.status).toBe('confirmed')
    expect(b.method).toBe('free')
    expect(b.confirmedAt).toBeInstanceOf(Date)
  })

  it('paid event cash → pending_payment (slot taken)', async () => {
    const ev = await makeEvent({ price: 1500 })
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
    expect(b.status).toBe('pending_payment')
  })

  it('blocks new subscription bookings while off without affecting cash, transfer, or free', async () => {
    const paid = await makeEvent({ price: 1500, capacity: 4 })
    const free = await makeEvent({ price: 0 })
    const plan = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Existing', totalSessions: 4, price: 4000 },
    )
    const subscriber = await newPlayer()
    const sub = await subscriptionService.createFromPlan({ userId: subscriber }, orgId, plan.id, {
      autoActivate: true,
    })
    await organizationService.update({ userId: ownerId }, orgId, { subscriptionsEnabled: false })
    await expect(
      bookingService.book({ userId: subscriber }, orgId, paid.id, {
        method: 'subscription',
        subscriptionId: sub.id,
      }),
    ).rejects.toMatchObject({ code: 'organization.subscriptions_disabled' })
    expect((await subscriptionService.getById({ userId: subscriber }, sub.id)).usedSessions).toBe(0)
    const cash = await bookingService.book({ userId: await newPlayer() }, orgId, paid.id, {
      method: 'cash',
    })
    const transfer = await bookingService.book({ userId: await newPlayer() }, orgId, paid.id, {
      method: 'transfer',
    })
    const freeBooking = await bookingService.book({ userId: subscriber }, orgId, free.id, {
      method: 'free',
    })
    expect(cash.status).toBe('pending_payment')
    expect(transfer.status).toBe('pending_payment')
    expect(freeBooking.status).toBe('confirmed')
  })

  it('full event → waitlisted', async () => {
    const ev = await makeEvent({ capacity: 1, price: 0 })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })
    const b2 = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'free' })
    expect(b2.status).toBe('waitlisted')
  })

  it('pending_payment counts toward capacity', async () => {
    const ev = await makeEvent({ capacity: 1, price: 1500 })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'cash' })
    const b2 = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'cash' })
    expect(b2.status).toBe('waitlisted')
  })

  it('double booking → AlreadyBookedError', async () => {
    const ev = await makeEvent()
    const pid = await newPlayer()
    await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    await expect(
      bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' }),
    ).rejects.toThrow(AlreadyBookedError)
  })

  it('cancelled event → EventNotBookableError', async () => {
    const ev = await makeEvent()
    await eventService.cancel({ userId: ownerId }, ev.id)
    const pid = await newPlayer()
    await expect(
      bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' }),
    ).rejects.toThrow(EventNotBookableError)
  })

  it('non-member → EventNotBookableError', async () => {
    const ev = await makeEvent()
    const [outsider] = await db
      .insert(users)
      .values({ email: `x-${Math.random()}@t.by` })
      .returning()
    await expect(
      bookingService.book({ userId: outsider!.id }, orgId, ev.id, { method: 'free' }),
    ).rejects.toThrow(EventNotBookableError)
  })

  it('re-book after cancel (reactivation)', async () => {
    const ev = await makeEvent()
    const pid = await newPlayer()
    const b1 = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    // отменяем напрямую (cancel-сервис в 5.6)
    await db
      .update((await import('@volley-time/db')).bookings)
      .set({ status: 'cancelled' })
      .where(
        (await import('@volley-time/db')).eq((await import('@volley-time/db')).bookings.id, b1.id),
      )
    const b2 = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    expect(b2.status).toBe('confirmed')
    expect(b2.id).toBe(b1.id) // та же строка (unique event+user)
  })

  it('listByEvent returns bookings with user, ordered by bookedAt', async () => {
    const ev = await makeEvent({ capacity: 5 })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'free' })
    const list = await bookingService.listByEvent({ userId: ownerId }, orgId, ev.id)
    expect(list).toHaveLength(2)
    expect(list[0]).toHaveProperty('user')
    // сериализуется (без BigInt) и без приватных полей (5.13.2)
    const json = JSON.stringify(list)
    expect(json).not.toMatch(/email|phone|telegramUserId|isRootAdmin/)
  })

  it('SECURITY: free/online on a paid event → method_not_allowed (5.13.9)', async () => {
    const ev = await makeEvent({ price: 1500 })
    const pid = await newPlayer()
    for (const method of ['free', 'online'] as const) {
      await expect(bookingService.book({ userId: pid }, orgId, ev.id, { method })).rejects.toThrow(
        BookingMethodNotAllowedError,
      )
    }
    const full = await makeEvent({ price: 1500, capacity: 1 })
    await bookingService.book({ userId: await newPlayer() }, orgId, full.id, { method: 'cash' })
    await expect(
      bookingService.book({ userId: pid }, orgId, full.id, { method: 'free' }),
    ).rejects.toThrow(BookingMethodNotAllowedError)
  })

  it('listMyBookings paginates in SQL (5.13.14)', async () => {
    const pid = await newPlayer()
    for (let i = 0; i < 3; i++) {
      const ev = await makeEvent()
      await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    }
    const first = await bookingService.listMyBookings({ userId: pid }, orgId, 'upcoming', {
      limit: 2,
    })
    const rest = await bookingService.listMyBookings({ userId: pid }, orgId, 'upcoming', {
      limit: 2,
      offset: 2,
    })
    expect(first).toHaveLength(2)
    expect(rest).toHaveLength(1)
    expect(first[0]!.event.startsAt <= first[1]!.event.startsAt).toBe(true)
    expect(await bookingService.listMyBookings({ userId: pid }, orgId, 'past')).toHaveLength(0)
  })

  it('listMyBookings filters upcoming', async () => {
    const ev = await makeEvent()
    const pid = await newPlayer()
    await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    const mine = await bookingService.listMyBookings({ userId: pid }, orgId, 'upcoming')
    expect(mine).toHaveLength(1)
    expect(mine[0]).toHaveProperty('event')
  })

  it('markAttendance sets attended/no_show', async () => {
    const ev = await makeEvent()
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    await startEvent(ev.id)
    await bookingService.bulkAttendance({ userId: ownerId }, orgId, ev.id, [
      { bookingId: b.id, attended: true },
    ])
    expect((await bookingService.getById({ userId: ownerId }, b.id)).status).toBe('attended')
    await bookingService.bulkAttendance({ userId: ownerId }, orgId, ev.id, [
      { bookingId: b.id, attended: false },
    ])
    expect((await bookingService.getById({ userId: ownerId }, b.id)).status).toBe('no_show')
  })

  it('cannot mark attendance for waitlisted', async () => {
    const ev = await makeEvent({ capacity: 1 })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })
    const wl = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'free' })
    await startEvent(ev.id)
    await expect(
      bookingService.bulkAttendance({ userId: ownerId }, orgId, ev.id, [
        { bookingId: wl.id, attended: true },
      ]),
    ).rejects.toThrow()
  })

  it('bulkAttendance marks multiple', async () => {
    const ev = await makeEvent({ capacity: 5 })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    const b1 = await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })
    const b2 = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'free' })
    await expect(
      bookingService.bulkAttendance({ userId: ownerId }, orgId, ev.id, [
        { bookingId: b1.id, attended: true },
      ]),
    ).rejects.toThrow(/after the event starts/)
    await startEvent(ev.id)
    const count = await bookingService.bulkAttendance({ userId: ownerId }, orgId, ev.id, [
      { bookingId: b1.id, attended: true },
      { bookingId: b2.id, attended: false },
    ])
    expect(count).toBe(2)
  })

  it('subscription booking consumes a session → confirmed', async () => {
    const ev = await makeEvent({ price: 1500 })
    const pid = await newPlayer()
    const plan = await planService.create(
      { userId: ownerId },
      {
        organizationId: orgId,
        name: 'Абонемент',
        totalSessions: 4,
        price: 4000,
      },
    )
    const sub = await subscriptionService.createFromPlan({ userId: pid }, orgId, plan.id, {
      autoActivate: true,
    })
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, {
      method: 'subscription',
      subscriptionId: sub.id,
    })
    expect(b.status).toBe('confirmed')
    expect(b.subscriptionId).toBe(sub.id)
    const after = await subscriptionService.getById({ userId: pid }, sub.id)
    expect(after.usedSessions).toBe(1)
  })

  it('subscription booking without active sub → error', async () => {
    const ev = await makeEvent({ price: 1500 })
    const pid = await newPlayer()
    await expect(
      bookingService.book({ userId: pid }, orgId, ev.id, { method: 'subscription' }),
    ).rejects.toThrow()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
