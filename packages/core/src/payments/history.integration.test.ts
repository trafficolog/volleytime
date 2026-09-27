import { bookings, closeDb, db, eq, organizations, payments, sql, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { organizationService } from '../organizations/service'

import { paymentService } from './service'

describe('payment history (integration)', () => {
  let userId: number
  let orgId: number
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [user] = await db
      .insert(users)
      .values({ name: 'Player', email: 'private@t.by', phone: '+375', telegramUserId: 123n })
      .returning()
    userId = user!.id
    orgId = (await organizationService.create({ userId }, { name: 'History' })).id
  })
  afterAll(() => closeDb())

  it('includes each status, filters it, isolates tenants and exposes only public fields', async () => {
    for (const status of ['pending', 'succeeded', 'cancelled', 'refunded'] as const) {
      await db.insert(payments).values({
        organizationId: orgId,
        userId,
        amount: 1200,
        currency: 'BYN',
        method: 'cash',
        status,
        note: 'private',
      })
    }
    const other = await organizationService.create({ userId }, { name: 'Other' })
    await db
      .insert(payments)
      .values({ organizationId: other.id, userId, amount: 9999, method: 'cash' })
    const result = await paymentService.listHistory({ userId }, orgId, { limit: 50 })
    expect(result.payments.map((p) => p.status).sort()).toEqual([
      'cancelled',
      'pending',
      'refunded',
      'succeeded',
    ])
    expect(result.nextCursor).toBeNull()
    expect(Object.keys(result.payments[0]!).sort()).toEqual([
      'amount',
      'confirmedAt',
      'createdAt',
      'currency',
      'event',
      'id',
      'method',
      'plan',
      'refundedAt',
      'status',
      'user',
    ])
    expect(Object.keys(result.payments[0]!.user).sort()).toEqual([
      'id',
      'image',
      'name',
      'telegramUsername',
    ])
    for (const status of ['pending', 'succeeded', 'cancelled', 'refunded'] as const) {
      const filtered = await paymentService.listHistory({ userId }, orgId, { limit: 50, status })
      expect(filtered.payments.map((p) => p.status)).toEqual([status])
    }
  })

  it('paginates microseconds within one millisecond and equal timestamps by descending id', async () => {
    const ids: number[] = []
    for (const time of [
      '2026-09-27T12:00:00.123100Z',
      '2026-09-27T12:00:00.123900Z',
      '2026-09-27T12:00:00.123900Z',
    ]) {
      const [p] = await db
        .insert(payments)
        .values({
          organizationId: orgId,
          userId,
          amount: 100,
          method: 'cash',
          createdAt: sql`${time}::timestamptz`,
        })
        .returning()
      ids.push(p!.id)
    }
    const first = await paymentService.listHistory({ userId }, orgId, { limit: 1 })
    expect(first.payments.map((p) => p.id)).toEqual([ids[2]])
    expect(first.nextCursor).toEqual({ id: ids[2], createdAt: '2026-09-27T12:00:00.123900Z' })
    const second = await paymentService.listHistory({ userId }, orgId, {
      limit: 1,
      cursor: first.nextCursor!,
    })
    expect(second.payments.map((p) => p.id)).toEqual([ids[1]])
    const third = await paymentService.listHistory({ userId }, orgId, {
      limit: 1,
      cursor: second.nextCursor!,
    })
    expect(third.payments.map((p) => p.id)).toEqual([ids[0]])
    expect(third.payments[0]!.createdAt).toBe('2026-09-27T12:00:00.123100Z')
    expect(third.nextCursor).toBeNull()
  })

  it('keeps a payment after its booking is deleted', async () => {
    const event = await eventService.create({ userId }, orgId, {
      title: 'Training',
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      capacity: 5,
      price: 100,
    })
    const booking = await bookingService.book({ userId }, orgId, event.id, { method: 'cash' })
    const before = await paymentService.listHistory({ userId }, orgId, { limit: 50 })
    expect(before.payments[0]!.event?.title).toBe('Training')
    await db.delete(bookings).where(eq(bookings.id, booking.id))
    const after = await paymentService.listHistory({ userId }, orgId, { limit: 50 })
    expect(after.payments[0]!.id).toBe(booking.paymentId)
    expect(after.payments[0]!.event).toBeNull()
    expect(after.payments[0]!.plan).toBeNull()
  })
})
