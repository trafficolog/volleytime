import {
  bookings,
  closeDb,
  db,
  eq,
  events,
  ledgerEntries,
  organizations,
  organizationMembers,
  payments,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { eventService } from '../events/service'
import type { PendingNotification } from '../notifier/types'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { bookingService } from './service'

describe('split reservations (PostgreSQL)', () => {
  let ownerId: number
  let playerId: number
  let orgId: number
  let eventId: number
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([{ email: 'split-owner@test.by' }, { email: 'split-player@test.by' }])
      .returning()
    ownerId = people[0]!.id
    playerId = people[1]!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Split' })).id
    await db
      .insert(organizationMembers)
      .values({ userId: playerId, organizationId: orgId, role: 'player', status: 'active' })
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    eventId = (
      await eventService.create({ userId: ownerId }, orgId, {
        title: 'Split',
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        capacity: 1,
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

  it.each(['cash', 'transfer'] as const)(
    'reserves split %s without payment, promotes unpaid waitlist, and rebooks',
    async (method) => {
      const notifications: PendingNotification[] = []
      vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'false')
      const booked = await bookingService.book({ userId: ownerId, notifications }, orgId, eventId, {
        method,
      })
      expect(booked).toMatchObject({
        status: 'pending_payment',
        method,
        paymentId: null,
        allocatedAmount: null,
        confirmedAt: null,
      })
      const waiting = await bookingService.book({ userId: playerId }, orgId, eventId, { method })
      expect(waiting).toMatchObject({
        status: 'waitlisted',
        method,
        paymentId: null,
        allocatedAmount: null,
      })
      expect(await paymentService.listPending({ userId: ownerId }, orgId)).toEqual([])
      expect(await db.select().from(ledgerEntries)).toEqual([])
      expect(
        (await bookingService.publicRoster({ userId: playerId }, orgId, eventId))[0],
      ).toMatchObject({ paid: false })
      expect(
        notifications.some((n) =>
          ['booking_confirmed', 'booking_pending_payment', 'payment_pending_organizer'].includes(
            n.type,
          ),
        ),
      ).toBe(false)
      const cancelled = await bookingService.cancel({ userId: ownerId }, booked.id)
      expect(cancelled.promoted).toMatchObject({
        id: waiting.id,
        status: 'pending_payment',
        method,
        paymentId: null,
        allocatedAmount: null,
      })
      await bookingService.cancel({ userId: playerId }, waiting.id)
      expect(
        await bookingService.book({ userId: ownerId }, orgId, eventId, { method }),
      ).toMatchObject({
        id: booked.id,
        status: 'pending_payment',
        paymentId: null,
        allocatedAmount: null,
      })
      expect(await db.select().from(payments)).toEqual([])
    },
  )
  it.each(['subscription', 'free', 'online'] as const)(
    'rejects split method %s without creating money or a booking',
    async (method) => {
      await expect(
        bookingService.book({ userId: ownerId }, orgId, eventId, { method }),
      ).rejects.toMatchObject({ code: 'booking.method_not_allowed' })
      expect(await db.select().from(bookings)).toEqual([])
      expect(await db.select().from(payments)).toEqual([])
    },
  )
  it('does not derive paid or attendance from a split booking status without succeeded payment', async () => {
    await db.insert(bookings).values({
      eventId,
      userId: ownerId,
      organizationId: orgId,
      method: 'cash',
      status: 'confirmed',
    })
    await db
      .update(events)
      .set({ startsAt: new Date(Date.now() - 1000) })
      .where(eq(events.id, eventId))
    const [booking] = await db.select().from(bookings)
    expect(
      (await bookingService.publicRoster({ userId: playerId }, orgId, eventId))[0],
    ).toMatchObject({ paid: false })
    await expect(
      bookingService.bulkAttendance({ userId: ownerId }, orgId, eventId, [
        { bookingId: booking!.id, attended: true },
      ]),
    ).rejects.toThrow()
  })
})
