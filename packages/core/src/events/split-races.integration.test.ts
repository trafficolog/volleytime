import {
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  events,
  inArray,
  ledgerEntries,
  organizations,
  organizationMembers,
  payments,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { behindEventLock } from '../__tests__/event-lock-barrier'
import { bookingService } from '../bookings/service'
import type { PendingNotification } from '../notifier/types'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { eventPricingService } from './pricing-service'
import { eventService } from './service'

describe('split money races (real PostgreSQL barriers)', { timeout: 30_000 }, () => {
  let ownerId: number
  let orgId: number
  let eventId: number
  let people: number[] = []
  const ctx = () => ({ userId: ownerId })
  const settle = () => eventPricingService.settle(ctx(), orgId, eventId)
  const reserve = (index: number) =>
    bookingService.book({ userId: people[index]! }, orgId, eventId, {
      method: index % 2 ? 'cash' : 'transfer',
    })
  const rows = () =>
    db.select().from(bookings).where(eq(bookings.eventId, eventId)).orderBy(bookings.id)
  const eventPayments = () =>
    db.select().from(payments).where(eq(payments.organizationId, orgId)).orderBy(payments.id)
  const race = (...operations: (() => Promise<unknown>)[]) => behindEventLock(eventId, operations)
  const assertSnapshot = async (
    ids: number[],
    amounts: number[],
    target = 10001,
    status = 'closed',
  ) => {
    const allocated = (await rows()).filter((b) => b.allocatedAmount !== null)
    expect(allocated.map((b) => b.id)).toEqual(ids)
    expect(allocated.map((b) => b.allocatedAmount)).toEqual(amounts)
    const paid = await eventPayments()
    expect(paid.map((p) => p.id).sort((a, b) => a - b)).toEqual(
      allocated.map((b) => b.paymentId!).sort((a, b) => a - b),
    )
    expect(paid.map((p) => [p.bookingId, p.amount])).toEqual(
      allocated.map((b) => [b.id, b.allocatedAmount]),
    )
    const [sum] = await db.execute(sql`SELECT sum(amount)::int AS total, count(*)::int AS n,
      count(DISTINCT booking_id)::int AS unique_bookings FROM payments WHERE organization_id = ${orgId}`)
    expect(sum).toMatchObject({ total: target, n: ids.length, unique_bookings: ids.length })
    expect(await db.query.events.findFirst({ where: eq(events.id, eventId) })).toMatchObject({
      status,
      pricingParticipantCount: ids.length,
      pricingSettledAt: expect.any(Date),
      targetAmount: target,
    })
    const audits = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
    expect(audits.filter((a) => a.action === 'event.pricing_settled')).toHaveLength(1)
    return allocated.map((b) => b.paymentId!)
  }

  beforeEach(async () => {
    people = (
      await db
        .insert(users)
        .values(
          Array.from({ length: 5 }, (_, i) => ({
            email: `split-race-${crypto.randomUUID()}-${i}@test.by`,
          })),
        )
        .returning()
    ).map((p) => p.id)
    ownerId = people[0]!
    orgId = (await organizationService.create(ctx(), { name: 'Split race' })).id
    await db.insert(organizationMembers).values(
      people.slice(1).map((userId) => ({
        userId,
        organizationId: orgId,
        role: 'player' as const,
        status: 'active' as const,
      })),
    )
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    eventId = (
      await eventService.create(ctx(), orgId, {
        title: 'Split race',
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        capacity: 3,
        priceMode: 'split',
        targetAmount: 10001,
      })
    ).id
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations).where(eq(organizations.id, orgId))
    await db.delete(users).where(inArray(users.id, people))
  })
  afterAll(closeDb)

  // Moving booking's event read before the shared lock would admit a new participant after closure.
  it.each([true, false])(
    'settle_vs_book_reloads_event_after_lock: settle first=%s',
    async (settleFirst) => {
      const first = await reserve(1)
      const book = () => reserve(2)
      const results = await race(
        ...(settleFirst ? ([settle, book] as const) : ([book, settle] as const)),
      )
      expect(results.map((r) => r.status)).toEqual(
        settleFirst ? ['fulfilled', 'rejected'] : ['fulfilled', 'fulfilled'],
      )
      if (settleFirst)
        expect(results[1]).toMatchObject({ reason: { code: 'booking.event_not_bookable' } })
      const all = await rows()
      expect(all).toHaveLength(settleFirst ? 1 : 2)
      await assertSnapshot(
        settleFirst ? [first.id] : all.map((b) => b.id),
        settleFirst ? [10001] : [5001, 5000],
      )
      expect((await eventService.getById(ctx(), eventId)).status).toBe('closed')
      await expect(reserve(3)).rejects.toThrow()
      expect(await rows()).toHaveLength(settleFirst ? 1 : 2)
    },
  )

  // A stale target read would allocate 10001 even when the queued update commits first.
  it.each([true, false])(
    'settle_vs_target_update_uses_locked_value: settle first=%s',
    async (settleFirst) => {
      const first = await reserve(1)
      const second = await reserve(2)
      const edit = () => eventService.update(ctx(), eventId, { targetAmount: 12003 })
      const results = await race(
        ...(settleFirst ? ([settle, edit] as const) : ([edit, settle] as const)),
      )
      expect(results.map((r) => r.status)).toEqual(
        settleFirst ? ['fulfilled', 'rejected'] : ['fulfilled', 'fulfilled'],
      )
      if (settleFirst)
        expect(results[1]).toMatchObject({ reason: { code: 'event.pricing_locked' } })
      await assertSnapshot(
        [first.id, second.id],
        settleFirst ? [5001, 5000] : [6002, 6001],
        settleFirst ? 10001 : 12003,
      )
    },
  )

  // Cancel must reread allocation after waiting; promotion must never run after settlement closes.
  it.each([true, false])('settle_vs_cancel_or_promotion: settle first=%s', async (settleFirst) => {
    await eventService.update(ctx(), eventId, { capacity: 1 })
    const first = await reserve(1)
    const waiting = await reserve(2)
    const cancel = () => bookingService.cancel({ userId: people[1]! }, first.id)
    const results = await race(
      ...(settleFirst ? ([settle, cancel] as const) : ([cancel, settle] as const)),
    )
    expect(results.map((r) => r.status)).toEqual(
      settleFirst ? ['fulfilled', 'rejected'] : ['fulfilled', 'fulfilled'],
    )
    if (settleFirst)
      expect(results[1]).toMatchObject({ reason: { code: 'booking.not_cancellable' } })
    await assertSnapshot([settleFirst ? first.id : waiting.id], [10001])
    expect(await bookingService.getById(ctx(), waiting.id)).toMatchObject(
      settleFirst
        ? { status: 'waitlisted', paymentId: null, allocatedAmount: null }
        : { status: 'pending_payment', allocatedAmount: 10001 },
    )
    expect(await bookingService.promoteFromWaitlist(ctx(), eventId)).toBeNull()
  })

  it.each([true, false])('direct promotion_vs_settle: settle first=%s', async (settleFirst) => {
    await eventService.update(ctx(), eventId, { capacity: 1 })
    const first = await reserve(1)
    const waiting = await reserve(2)
    await eventService.update(ctx(), eventId, { capacity: 2 })
    const promote = () => bookingService.promoteFromWaitlist(ctx(), eventId)
    const results = await race(
      ...(settleFirst ? ([settle, promote] as const) : ([promote, settle] as const)),
    )
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
    expect(results[settleFirst ? 1 : 0]).toMatchObject({
      value: settleFirst ? null : { id: waiting.id, paymentId: null },
    })
    await assertSnapshot(
      settleFirst ? [first.id] : [first.id, waiting.id],
      settleFirst ? [10001] : [5001, 5000],
    )
    expect(await bookingService.promoteFromWaitlist(ctx(), eventId)).toBeNull()
  })

  it('concurrent_settle_is_one_snapshot', async () => {
    const first = await reserve(1)
    const second = await reserve(2)
    const results = await race(settle, settle)
    expect(results[0]?.status).toBe('fulfilled')
    expect(results[1]).toEqual(results[0])
    const ids = await assertSnapshot([first.id, second.id], [5001, 5000])
    await paymentService.confirm(ctx(), ids[0]!)
    await paymentService.cancel(ctx(), ids[1]!)
    const repeated = await race(settle, settle)
    expect(repeated).toEqual(results)
    expect(await assertSnapshot([first.id, second.id], [5001, 5000])).toEqual(ids)
  })

  it.each([true, false])('full event cancel_vs_settle: settle first=%s', async (settleFirst) => {
    const first = await reserve(1)
    const cancel = () => eventService.cancel(ctx(), eventId)
    const results = await race(
      ...(settleFirst ? ([settle, cancel] as const) : ([cancel, settle] as const)),
    )
    expect(results.map((r) => r.status)).toEqual(
      settleFirst ? ['fulfilled', 'fulfilled'] : ['fulfilled', 'rejected'],
    )
    expect((await eventService.getById(ctx(), eventId)).status).toBe('cancelled')
    if (settleFirst) {
      await assertSnapshot([first.id], [10001], 10001, 'cancelled')
      expect((await eventPayments()).map((p) => p.status)).toEqual(['cancelled'])
    } else {
      expect(results[1]).toMatchObject({ reason: { code: 'event.not_settleable' } })
      expect(await eventPayments()).toEqual([])
      expect(await eventService.getById(ctx(), eventId)).toMatchObject({
        pricingSettledAt: null,
        pricingParticipantCount: null,
      })
    }
    expect(
      await db.select().from(ledgerEntries).where(eq(ledgerEntries.organizationId, orgId)),
    ).toEqual([])
  })

  // A failed second allocation must undo the first real INSERT, link, and all settlement metadata.
  it('mid-allocation database failure rolls back money, event, bookings, audit and notifications', async () => {
    const first = await reserve(1)
    const second = await reserve(2)
    const before = await rows()
    const beforeAudit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
    const beforeEvent = await eventService.getById(ctx(), eventId)
    const notifications: PendingNotification[] = []
    const constraint = `split_race_fail_${eventId}`
    await db.execute(
      sql.raw(
        `ALTER TABLE payments ADD CONSTRAINT ${constraint} CHECK (booking_id <> ${second.id})`,
      ),
    )
    try {
      await expect(
        eventPricingService.settle({ ...ctx(), notifications }, orgId, eventId),
      ).rejects.toMatchObject({ cause: { code: '23514' } })
    } finally {
      await db.execute(sql.raw(`ALTER TABLE payments DROP CONSTRAINT ${constraint}`))
    }
    expect(await eventPayments()).toEqual([])
    expect(await rows()).toEqual(before)
    expect(await eventService.getById(ctx(), eventId)).toEqual(beforeEvent)
    expect(await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))).toEqual(
      beforeAudit,
    )
    expect(notifications).toEqual([])
    await settle()
    await assertSnapshot([first.id, second.id], [5001, 5000])
  })
})
