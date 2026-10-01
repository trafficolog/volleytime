import {
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  events,
  ledgerEntries,
  organizations,
  organizationMembers,
  payments,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import type { PendingNotification } from '../notifier/types'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { eventService } from './service'

import * as pricing from './index'

describe('atomic split settlement (PostgreSQL)', () => {
  let ownerId: number
  let playerIds: number[]
  let orgId: number
  let eventId: number
  const ctx = () => ({ userId: ownerId })
  const settle = async () => {
    expect(pricing.eventPricingService, 'settlement service must exist').toBeDefined()
    return pricing.eventPricingService.settle(ctx(), orgId, eventId)
  }
  const reserve = async (count = 3) => {
    const result = []
    for (const userId of playerIds.slice(0, count))
      result.push(await bookingService.book({ userId }, orgId, eventId, { method: 'cash' }))
    return result
  }
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values(Array.from({ length: 5 }, (_, i) => ({ email: `settle-${i}@test.by` })))
      .returning()
    ownerId = people[0]!.id
    playerIds = people.slice(1).map((p) => p.id)
    orgId = (await organizationService.create(ctx(), { name: 'Settlement' })).id
    await db.insert(organizationMembers).values(
      playerIds.map((userId) => ({
        userId,
        organizationId: orgId,
        role: 'player' as const,
        status: 'active' as const,
      })),
    )
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    eventId = (
      await eventService.create(ctx(), orgId, {
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

  it('settles atomically and repeats after confirm or reject without new money or audit', async () => {
    const reserved = await reserve()
    const waiting = await bookingService.book({ userId: playerIds[3]! }, orgId, eventId, {
      method: 'transfer',
    })
    const notifications: PendingNotification[] = []
    expect(pricing.eventPricingService).toBeDefined()
    const result = await pricing.eventPricingService.settle(
      { ...ctx(), notifications },
      orgId,
      eventId,
    )
    expect(result.summary).toEqual({
      targetAmount: 10000,
      participantCount: 3,
      minAmount: 3333,
      maxAmount: 3334,
    })
    expect(result.event).toMatchObject({
      status: 'closed',
      pricingParticipantCount: 3,
      pricingSettledAt: expect.any(Date),
    })
    const allocated = await db.query.bookings.findMany({
      where: eq(bookings.eventId, eventId),
      orderBy: bookings.id,
    })
    expect(allocated.map((b) => b.allocatedAmount)).toEqual([3334, 3333, 3333, null])
    expect(allocated[3]).toMatchObject({ id: waiting.id, paymentId: null, status: 'waitlisted' })
    expect((await db.select().from(payments)).map((p) => p.amount)).toEqual([3334, 3333, 3333])
    expect(await db.select().from(ledgerEntries)).toEqual([])
    expect(notifications.filter((n) => n.type === 'payment_pending_organizer')).toEqual([])
    const auditCount = (await db.select().from(auditLog)).length
    await paymentService.confirm(ctx(), allocated[0]!.paymentId!)
    await paymentService.cancel(ctx(), allocated[1]!.paymentId!)
    const again = await settle()
    expect(again).toEqual(result)
    expect((await db.select().from(auditLog)).length).toBe(auditCount + 1)
    expect(
      (await db.query.bookings.findMany({ orderBy: bookings.id })).map((b) => [
        b.paymentId,
        b.allocatedAmount,
      ]),
    ).toEqual(allocated.map((b) => [b.paymentId, b.allocatedAmount]))
    expect(await db.select().from(payments)).toHaveLength(3)
    expect(await db.select().from(ledgerEntries)).toMatchObject([{ type: 'income', amount: 3334 }])
    expect(await bookingService.promoteFromWaitlist(ctx(), eventId)).toBeNull()
    await expect(
      bookingService.cancel({ userId: playerIds[0]! }, reserved[0]!.id),
    ).rejects.toThrow()
    await expect(
      bookingService.book({ userId: playerIds[1]! }, orgId, eventId, { method: 'cash' }),
    ).rejects.toThrow()
    await expect(eventService.update(ctx(), eventId, { status: 'published' })).rejects.toThrow()
    expect(await pricing.readEventPricing({ userId: playerIds[0]! }, eventId)).toMatchObject({
      basis: 'settled',
      participantCount: 3,
      minAmount: 3333,
      maxAmount: 3334,
      myAllocatedAmount: 3334,
      myPaymentStatus: 'succeeded',
    })
    expect((await bookingService.publicRoster(ctx(), orgId, eventId)).map((r) => r.paid)).toEqual([
      true,
      false,
    ])
  })

  it('full cancel refunds previously removed paid split once and preserves allocations', async () => {
    await reserve()
    await settle()
    const [first] = await db.query.bookings.findMany({ orderBy: bookings.id })
    await paymentService.confirm(ctx(), first!.paymentId!)
    await bookingService.cancel(ctx(), first!.id, { byAdmin: true })
    expect((await paymentService.getById(ctx(), first!.paymentId!)).status).toBe('succeeded')
    expect(await pricing.readPricingFinancials(ctx(), eventId)).toEqual({
      collected: 3334,
      pending: 6666,
      cancelled: 0,
      refunded: 0,
      currency: 'BYN',
    })
    await eventService.cancel(ctx(), eventId)
    await eventService.cancel(ctx(), eventId)
    expect((await paymentService.getById(ctx(), first!.paymentId!)).status).toBe('refunded')
    expect(await db.select().from(ledgerEntries)).toMatchObject([
      { type: 'income', amount: 3334 },
      { type: 'expense', category: 'refund', amount: 3334 },
    ])
    expect((await bookingService.getById(ctx(), first!.id)).allocatedAmount).toBe(3334)
    expect(await pricing.readPricingFinancials(ctx(), eventId)).toEqual({
      collected: 0,
      pending: 0,
      cancelled: 6666,
      refunded: 3334,
      currency: 'BYN',
    })
  })

  it.each([0, 3])(
    'rejects invalid participant/target counts (%s participants) atomically',
    async (count) => {
      await reserve(count)
      await eventService.update(ctx(), eventId, { targetAmount: 2 })
      expect(pricing.eventPricingService).toBeDefined()
      await expect(pricing.eventPricingService.settle(ctx(), orgId, eventId)).rejects.toMatchObject(
        { code: count === 0 ? 'event.split_empty' : 'event.split_target_too_small' },
      )
      expect(await db.select().from(payments)).toEqual([])
      expect(await eventService.getById(ctx(), eventId)).toMatchObject({
        status: 'published',
        pricingSettledAt: null,
      })
    },
  )
  it('rejects wrong tenant, player, inactive manager and non-published state', async () => {
    await reserve(1)
    expect(pricing.eventPricingService).toBeDefined()
    await expect(
      pricing.eventPricingService.settle(ctx(), orgId + 10000, eventId),
    ).rejects.toThrow()
    await expect(
      pricing.eventPricingService.settle({ userId: playerIds[0]! }, orgId, eventId),
    ).rejects.toThrow()
    await db
      .update(organizationMembers)
      .set({ status: 'blocked' })
      .where(eq(organizationMembers.userId, ownerId))
    await expect(pricing.eventPricingService.settle(ctx(), orgId, eventId)).rejects.toThrow()
    await db
      .update(organizationMembers)
      .set({ status: 'active' })
      .where(eq(organizationMembers.userId, ownerId))
    await eventService.update(ctx(), eventId, { status: 'draft' })
    await expect(pricing.eventPricingService.settle(ctx(), orgId, eventId)).rejects.toThrow()
    expect(await db.select().from(payments)).toEqual([])
  })
  it('rolls back earlier payments, allocations, status and audit when a later database insert fails', async () => {
    const reserved = await reserve()
    expect(pricing.eventPricingService).toBeDefined()
    const beforeAudit = await db.select().from(auditLog)
    await db.execute(
      sql.raw(
        `ALTER TABLE payments ADD CONSTRAINT split_test_reject_insert CHECK (booking_id <> ${reserved[1]!.id})`,
      ),
    )
    try {
      await expect(pricing.eventPricingService.settle(ctx(), orgId, eventId)).rejects.toThrow()
    } finally {
      await db.execute(sql`ALTER TABLE payments DROP CONSTRAINT split_test_reject_insert`)
    }
    expect(await db.select().from(payments)).toEqual([])
    expect(
      (await db.select().from(bookings)).every(
        (b) => b.paymentId === null && b.allocatedAmount === null,
      ),
    ).toBe(true)
    expect(await eventService.getById(ctx(), eventId)).toMatchObject({
      status: 'published',
      pricingSettledAt: null,
      pricingParticipantCount: null,
    })
    expect(await db.select().from(auditLog)).toEqual(beforeAudit)
  })
  it('permits settlement after start and only paid settled attendance', async () => {
    const reserved = await reserve(1)
    await db
      .update(events)
      .set({ startsAt: new Date(Date.now() - 1000) })
      .where(eq(events.id, eventId))
    await settle()
    await expect(
      bookingService.bulkAttendance(ctx(), orgId, eventId, [
        { bookingId: reserved[0]!.id, attended: true },
      ]),
    ).rejects.toThrow()
    const booking = await bookingService.getById(ctx(), reserved[0]!.id)
    await paymentService.confirm(ctx(), booking.paymentId!)
    expect(
      await bookingService.bulkAttendance(ctx(), orgId, eventId, [
        { bookingId: booking.id, attended: true },
      ]),
    ).toBe(1)
  })
})
