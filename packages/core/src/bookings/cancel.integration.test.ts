import { closeDb, db, eq, events, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { planService } from '../subscription-plans/service'
import { subscriptionService } from '../subscriptions/service'

import {
  BookingDeadlinePassedError,
  BookingNotCancellableError,
  CannotCancelOthersError,
} from './errors'
import { bookingService } from './service'

let ownerId: number
let orgId: number

const future = (h = 24) => new Date(Date.now() + h * 3600_000)

async function newPlayer() {
  const [u] = await db
    .insert(users)
    .values({ email: `c-${Math.random()}@t.by` })
    .returning()
  await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
  return u!.id
}

async function makeEvent(
  opts: { capacity?: number; price?: number; deadlineHours?: number | null } = {},
) {
  return eventService.create({ userId: ownerId }, orgId, {
    title: 'Тренировка',
    startsAt: future(),
    endsAt: future(26),
    capacity: opts.capacity ?? 2,
    price: opts.price ?? 0,
    cancellationDeadlineHours: opts.deadlineHours,
  })
}

describe('bookingService.cancel + promotion (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Cancel Org' })
    orgId = org.id
  })

  it('self cancel sets cancelled', async () => {
    const ev = await makeEvent()
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    const { booking } = await bookingService.cancel({ userId: pid }, b.id)
    expect(booking.status).toBe('cancelled')
  })

  it('cancel is idempotent', async () => {
    const ev = await makeEvent()
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    await bookingService.cancel({ userId: pid }, b.id)
    const { booking } = await bookingService.cancel({ userId: pid }, b.id)
    expect(booking.status).toBe('cancelled')
  })

  it('cannot cancel others booking (non-admin)', async () => {
    const ev = await makeEvent()
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    const b = await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })
    await expect(bookingService.cancel({ userId: p2 }, b.id)).rejects.toThrow(
      CannotCancelOthersError,
    )
  })

  it('admin can cancel others booking', async () => {
    const ev = await makeEvent()
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    const { booking } = await bookingService.cancel({ userId: ownerId }, b.id, { byAdmin: true })
    expect(booking.status).toBe('cancelled')
  })

  it('deadline passed → self cancel blocked (admin bypasses)', async () => {
    // событие через 1ч, дедлайн 2ч до начала → уже прошёл
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Soon',
      startsAt: future(1),
      endsAt: future(3),
      capacity: 5,
      price: 0,
      cancellationDeadlineHours: 2,
    })
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    await expect(bookingService.cancel({ userId: pid }, b.id)).rejects.toThrow(
      BookingDeadlinePassedError,
    )
    // admin обходит
    const { booking } = await bookingService.cancel({ userId: ownerId }, b.id, { byAdmin: true })
    expect(booking.status).toBe('cancelled')
  })

  it('subscription booking cancel restores session', async () => {
    const ev = await makeEvent({ price: 1500 })
    const pid = await newPlayer()
    const plan = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Абонемент', totalSessions: 4 },
    )
    const sub = await subscriptionService.createFromPlan({ userId: pid }, orgId, plan.id, {
      autoActivate: true,
    })
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, {
      method: 'subscription',
      subscriptionId: sub.id,
    })
    expect((await subscriptionService.getById({ userId: pid }, sub.id)).usedSessions).toBe(1)
    await bookingService.cancel({ userId: pid }, b.id)
    expect((await subscriptionService.getById({ userId: pid }, sub.id)).usedSessions).toBe(0)
  })

  it('PROMOTION: cancel confirmed → first waitlisted promoted', async () => {
    const ev = await makeEvent({ capacity: 1, price: 0 })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    const b1 = await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })
    const b2 = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'free' })
    expect(b2.status).toBe('waitlisted')
    const { promoted } = await bookingService.cancel({ userId: p1 }, b1.id)
    expect(promoted?.id).toBe(b2.id)
    expect(promoted?.status).toBe('confirmed')
  })

  it('PROMOTION: paid event → promoted to pending_payment', async () => {
    const ev = await makeEvent({ capacity: 1, price: 1500 })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    const b1 = await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'cash' })
    await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'cash' })
    const { promoted } = await bookingService.cancel({ userId: p1 }, b1.id, { byAdmin: true })
    expect(promoted?.status).toBe('pending_payment')
  })

  it('no promotion when waitlist empty', async () => {
    const ev = await makeEvent({ capacity: 2, price: 0 })
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    const { promoted } = await bookingService.cancel({ userId: pid }, b.id)
    expect(promoted).toBeNull()
  })

  it('rebooking cash → cancel → subscription keeps links consistent (5.13.8)', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Rebook',
      startsAt: new Date(Date.now() + 48 * 3600_000),
      endsAt: new Date(Date.now() + 50 * 3600_000),
      capacity: 5,
      price: 1500,
    })
    const pid = await newPlayer()
    const plan = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'План', totalSessions: 4, price: 5000 },
    )
    const sub = await subscriptionService.createFromPlan({ userId: pid }, orgId, plan.id, {
      autoActivate: true,
    })
    const cashBooking = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
    const oldPaymentId = cashBooking.paymentId
    expect(oldPaymentId).not.toBeNull()
    await bookingService.cancel({ userId: pid }, cashBooking.id)

    const again = await bookingService.book({ userId: pid }, orgId, ev.id, {
      method: 'subscription',
      subscriptionId: sub.id,
    })
    expect(again.id).toBe(cashBooking.id)
    expect(again.subscriptionId).toBe(sub.id)
    expect(again.paymentId).toBeNull()
    expect((await subscriptionService.getById({ userId: pid }, sub.id)).usedSessions).toBe(1)

    await bookingService.cancel({ userId: pid }, again.id)
    expect((await subscriptionService.getById({ userId: pid }, sub.id)).usedSessions).toBe(0)
  })

  it('cannot cancel attended booking or after start; session not restored (5.13.10)', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Attended',
      startsAt: future(48),
      endsAt: future(50),
      capacity: 5,
      price: 1500,
    })
    const pid = await newPlayer()
    const plan = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'План', totalSessions: 4, price: 5000 },
    )
    const sub = await subscriptionService.createFromPlan({ userId: pid }, orgId, plan.id, {
      autoActivate: true,
    })
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, {
      method: 'subscription',
      subscriptionId: sub.id,
    })
    await db
      .update(events)
      .set({ startsAt: new Date(Date.now() - 600_000) })
      .where(eq(events.id, ev.id))
    await expect(
      bookingService.cancel({ userId: ownerId }, b.id, { byAdmin: true }),
    ).rejects.toThrow(BookingNotCancellableError)
    await bookingService.bulkAttendance({ userId: ownerId }, orgId, ev.id, [
      { bookingId: b.id, attended: true },
    ])
    await expect(bookingService.cancel({ userId: pid }, b.id)).rejects.toThrow(
      BookingNotCancellableError,
    )
    expect((await subscriptionService.getById({ userId: pid }, sub.id)).usedSessions).toBe(1)
  })

  it('waitlist promotion with subscription consumes a session; exhausted → pending_payment (5.13.6)', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Promo sub',
      startsAt: future(48),
      endsAt: future(50),
      capacity: 1,
      price: 1500,
    })
    const plan = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'План', totalSessions: 1, price: 5000 },
    )
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    const p3 = await newPlayer()
    const sub2 = await subscriptionService.createFromPlan({ userId: p2 }, orgId, plan.id, {
      autoActivate: true,
    })
    const b1 = await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'cash' })
    const w2 = await bookingService.book({ userId: p2 }, orgId, ev.id, {
      method: 'subscription',
      subscriptionId: sub2.id,
    })
    expect(w2.status).toBe('waitlisted')
    expect((await subscriptionService.getById({ userId: p2 }, sub2.id)).usedSessions).toBe(0)
    // p3 без абонемента в листе ожидания «с абонементом»
    await bookingService.book({ userId: p3 }, orgId, ev.id, { method: 'subscription' })

    const { promoted } = await bookingService.cancel({ userId: p1 }, b1.id)
    expect(promoted).toMatchObject({ id: w2.id, status: 'confirmed', subscriptionId: sub2.id })
    expect((await subscriptionService.getById({ userId: p2 }, sub2.id)).usedSessions).toBe(1)

    const second = await bookingService.cancel({ userId: p2 }, w2.id)
    expect((await subscriptionService.getById({ userId: p2 }, sub2.id)).usedSessions).toBe(0)
    expect(second.promoted).toMatchObject({ userId: p3, status: 'pending_payment', method: 'cash' })
    expect(second.promoted?.paymentId).not.toBeNull()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
