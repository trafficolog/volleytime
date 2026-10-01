import {
  closeDb,
  db,
  bookings,
  eq,
  events,
  inArray,
  ledgerEntries,
  organizations,
  payments,
  sql,
  subscriptions,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { behindEventLock } from '../__tests__/event-lock-barrier'
import { bookingService } from '../bookings/service'
import { eventPricingService } from '../events/pricing-service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { createNotificationCollector } from '../notifier/collect'
import { organizationService } from '../organizations/service'

import { paymentService } from './service'

/** Денежные гонки из ревью v0.1.0 (6.8.1, 6.8.2, 6.8.10). */
describe('money races (integration)', { timeout: 30_000 }, () => {
  let ownerId: number
  let orgId: number
  let fixtureUsers: number[] = []
  let fixtureOrgs: number[] = []
  const newPlayer = async () => {
    const [u] = await db
      .insert(users)
      .values({ email: `mr-${Math.random()}@t.by` })
      .returning()
    fixtureUsers.push(u!.id)
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
    return u!.id
  }
  const paidEvent = (capacity = 10) =>
    eventService.create({ userId: ownerId }, orgId, {
      title: 'Race money',
      startsAt: new Date(Date.now() + 72 * 3600_000),
      endsAt: new Date(Date.now() + 74 * 3600_000),
      capacity,
      price: 1500,
    })
  const incomes = (paymentId: number) =>
    db.select().from(ledgerEntries).where(eq(ledgerEntries.paymentId, paymentId))

  beforeEach(async () => {
    fixtureUsers = []
    fixtureOrgs = []
    const [o] = await db.insert(users).values({ email: 'mr-owner@t.by' }).returning()
    ownerId = o!.id
    fixtureUsers.push(ownerId)
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Money Races' })).id
    fixtureOrgs.push(orgId)
  })

  it('6.8.1: 10 parallel confirms → exactly one income (5 runs)', async () => {
    for (let run = 0; run < 5; run++) {
      const ev = await paidEvent()
      const b = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
        method: 'cash',
      })
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () =>
          paymentService.confirm({ userId: ownerId }, b.paymentId!, { orgId }),
        ),
      )
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
      expect(rejected.every((r) => /not pending/i.test(String(r.reason?.message)))).toBe(true)
      expect(await incomes(b.paymentId!)).toHaveLength(1)
    }
  })

  it.each([true, false])('6.8.1: confirm vs reject — confirm first=%s', async (confirmFirst) => {
    const ev = await paidEvent()
    const b = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
      method: 'cash',
    })
    const confirm = () => paymentService.confirm({ userId: ownerId }, b.paymentId!, { orgId })
    const reject = () => paymentService.cancel({ userId: ownerId }, b.paymentId!, { orgId })
    const results = await behindEventLock(
      ev.id,
      confirmFirst ? [confirm, reject] : [reject, confirm],
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const [p] = await db.select().from(payments).where(eq(payments.id, b.paymentId!))
    const income = await incomes(b.paymentId!)
    expect(p!.status).toBe(confirmFirst ? 'succeeded' : 'cancelled')
    expect(income.length).toBe(confirmFirst ? 1 : 0)
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'payment.not_pending' },
    })
  })

  it.each([
    ['confirm', 'reject', 'cancel'],
    ['confirm', 'cancel', 'reject'],
    ['reject', 'confirm', 'cancel'],
    ['reject', 'cancel', 'confirm'],
    ['cancel', 'confirm', 'reject'],
    ['cancel', 'reject', 'confirm'],
  ] as const)('confirm_reject_full_cancel_no_double_money: %s → %s → %s', async (...order) => {
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Split money race',
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      capacity: 2,
      priceMode: 'split',
      targetAmount: 10001,
    })
    const removed = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
      method: 'cash',
    })
    const pending = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
      method: 'transfer',
    })
    const waiting = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
      method: 'cash',
    })
    const snapshot = await eventPricingService.settle({ userId: ownerId }, orgId, ev.id)
    const removedPaymentId = (await bookingService.getById({ userId: ownerId }, removed.id))
      .paymentId!
    const pendingPaymentId = (await bookingService.getById({ userId: ownerId }, pending.id))
      .paymentId!
    await paymentService.confirm({ userId: ownerId }, removedPaymentId, { orgId })
    await bookingService.cancel({ userId: ownerId }, removed.id, { byAdmin: true })
    expect((await paymentService.getById({ userId: ownerId }, removedPaymentId)).status).toBe(
      'succeeded',
    )
    const actions = {
      confirm: () => paymentService.confirm({ userId: ownerId }, pendingPaymentId, { orgId }),
      reject: () => paymentService.cancel({ userId: ownerId }, pendingPaymentId, { orgId }),
      cancel: () => eventService.cancel({ userId: ownerId }, ev.id),
    }
    const outcomes = await behindEventLock(
      ev.id,
      order.map((action) => actions[action]),
    )
    for (const [index, result] of outcomes.entries()) {
      const shouldSucceed = index === 0 || order[index] === 'cancel'
      expect(result.status).toBe(shouldSucceed ? 'fulfilled' : 'rejected')
      if (result.status === 'rejected')
        expect(result.reason).toMatchObject({ code: 'payment.not_pending' })
    }
    await eventService.cancel({ userId: ownerId }, ev.id)
    expect((await eventService.getById({ userId: ownerId }, ev.id)).status).toBe('cancelled')
    expect(await paymentService.getById({ userId: ownerId }, removedPaymentId)).toMatchObject({
      status: 'refunded',
      amount: 5001,
    })
    expect(await incomes(removedPaymentId)).toMatchObject([
      { type: 'income', amount: 5001 },
      { category: 'refund', amount: 5001 },
    ])
    const confirmed = order[0] === 'confirm'
    expect(await paymentService.getById({ userId: ownerId }, pendingPaymentId)).toMatchObject({
      status: confirmed ? 'refunded' : 'cancelled',
      amount: 5000,
    })
    const entries = await incomes(pendingPaymentId)
    expect(entries.filter((e) => e.type === 'income')).toHaveLength(confirmed ? 1 : 0)
    expect(entries.filter((e) => e.category === 'refund')).toHaveLength(confirmed ? 1 : 0)
    expect(entries.every((e) => e.amount === 5000)).toBe(true)
    expect(await bookingService.getById({ userId: ownerId }, waiting.id)).toMatchObject({
      paymentId: null,
      allocatedAmount: null,
    })
    expect(await bookingService.promoteFromWaitlist({ userId: ownerId }, ev.id)).toBeNull()
    const again = await eventPricingService.settle({ userId: ownerId }, orgId, ev.id)
    expect(again.summary).toEqual(snapshot.summary)
    const allocated = await db
      .select()
      .from(bookings)
      .where(eq(bookings.eventId, ev.id))
      .orderBy(bookings.id)
    expect(allocated.map((b) => [b.paymentId, b.allocatedAmount])).toEqual([
      [removedPaymentId, 5001],
      [pendingPaymentId, 5000],
      [null, null],
    ])
    const paid = await db
      .select()
      .from(payments)
      .where(eq(payments.organizationId, orgId))
      .orderBy(payments.id)
    expect(paid.map((p) => p.id)).toEqual([removedPaymentId, pendingPaymentId])
    expect(paid.reduce((sum, p) => sum + p.amount, 0)).toBe(10001)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations).where(inArray(organizations.id, fixtureOrgs))
    await db.delete(users).where(inArray(users.id, fixtureUsers))
  })

  it('6.8.2: parallel event cancellations → one refund per payment, sessions restored once', async () => {
    for (let run = 0; run < 3; run++) {
      const ev = await paidEvent()
      const booked = []
      for (let i = 0; i < 3; i++) {
        const b = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
          method: 'cash',
        })
        await paymentService.confirm({ userId: ownerId }, b.paymentId!, { orgId })
        booked.push(b)
      }
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => eventService.cancel({ userId: ownerId }, ev.id)),
      )
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
      for (const b of booked) {
        const rows = await incomes(b.paymentId!)
        expect(rows.filter((r) => r.category === 'refund')).toHaveLength(1)
        expect(rows.filter((r) => r.type === 'income')).toHaveLength(1)
      }
    }
  })

  it('6.8.13: confirm queued before event cancel leaves no succeeded payment on a cancelled event', async () => {
    const ev = await paidEvent()
    const b = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
      method: 'cash',
    })
    let unlock!: () => void
    let locked!: () => void
    let blockerPid = 0
    const lockReady = new Promise<void>((resolve) => (locked = resolve))
    const released = new Promise<void>((resolve) => (unlock = resolve))
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(payments).where(eq(payments.id, b.paymentId!)).for('update')
      const [session] = await tx.execute(sql`SELECT pg_backend_pid()::int AS pid`)
      blockerPid = Number(session?.pid)
      locked()
      await released
    })
    await lockReady

    const operations: Promise<unknown>[] = [
      blocker,
      paymentService.confirm({ userId: ownerId }, b.paymentId!, { orgId }),
    ]
    const waitForBlocked = async (minimum: number) => {
      let blocked = 0
      for (let attempt = 0; attempt < 500; attempt++) {
        const [state] = await db.execute(sql`WITH RECURSIVE waiting(pid) AS (
          SELECT pid FROM pg_stat_activity WHERE ${blockerPid} = ANY(pg_blocking_pids(pid))
          UNION
          SELECT activity.pid FROM pg_stat_activity AS activity, waiting
          WHERE waiting.pid = ANY(pg_blocking_pids(activity.pid))
        ) SELECT count(*)::int AS n FROM waiting`)
        blocked = Number(state?.n)
        if (blocked >= minimum) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect(blocked).toBeGreaterThanOrEqual(minimum)
    }
    let outcomes: PromiseSettledResult<unknown>[] = []
    try {
      await waitForBlocked(1)
      operations.push(eventService.cancel({ userId: ownerId }, ev.id))
      await waitForBlocked(2)
    } finally {
      unlock()
      outcomes = await Promise.allSettled(operations)
    }

    expect(outcomes.slice(1).every((result) => result.status === 'fulfilled')).toBe(true)
    const [finishedEvent] = await db.select().from(events).where(eq(events.id, ev.id))
    const [finishedBooking] = await db.select().from(bookings).where(eq(bookings.id, b.id))
    const [finishedPayment] = await db.select().from(payments).where(eq(payments.id, b.paymentId!))
    const entries = await incomes(b.paymentId!)
    expect(finishedEvent?.status).toBe('cancelled')
    expect(finishedBooking?.status).toBe('cancelled')
    expect(finishedPayment?.status).toBe('refunded')
    expect(entries.filter((entry) => entry.type === 'income')).toHaveLength(1)
    expect(entries.filter((entry) => entry.category === 'refund')).toHaveLength(1)

    const nextEvent = await paidEvent()
    const nextBooking = await bookingService.book(
      { userId: await newPlayer() },
      orgId,
      nextEvent.id,
      {
        method: 'cash',
      },
    )
    await eventService.cancel({ userId: ownerId }, nextEvent.id)
    await expect(
      paymentService.confirm({ userId: ownerId }, nextBooking.paymentId!, { orgId }),
    ).rejects.toThrow(/not pending/i)
    const [cancelledPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, nextBooking.paymentId!))
    expect(cancelledPayment?.status).toBe('cancelled')
    expect(await incomes(nextBooking.paymentId!)).toHaveLength(0)
  })

  it('6.8.14: payment rejection and event cancellation do not deadlock', async () => {
    const ev = await paidEvent()
    const b = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
      method: 'cash',
    })
    let unlock!: () => void
    let locked!: () => void
    let blockerPid = 0
    const lockReady = new Promise<void>((resolve) => (locked = resolve))
    const released = new Promise<void>((resolve) => (unlock = resolve))
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(events).where(eq(events.id, ev.id)).for('update')
      const [session] = await tx.execute(sql`SELECT pg_backend_pid()::int AS pid`)
      blockerPid = Number(session?.pid)
      locked()
      await released
    })
    await lockReady

    const eventNotifications = createNotificationCollector()
    const paymentNotifications = createNotificationCollector()
    const operations: Promise<unknown>[] = [
      blocker,
      eventService.cancel({ userId: ownerId, notifications: eventNotifications }, ev.id),
    ]
    const waitForBlocked = async (minimum: number) => {
      let blocked = 0
      for (let attempt = 0; attempt < 500; attempt++) {
        const [state] = await db.execute(sql`WITH RECURSIVE waiting(pid) AS (
          SELECT pid FROM pg_stat_activity WHERE ${blockerPid} = ANY(pg_blocking_pids(pid))
          UNION
          SELECT activity.pid FROM pg_stat_activity AS activity, waiting
          WHERE waiting.pid = ANY(pg_blocking_pids(activity.pid))
        ) SELECT count(*)::int AS n FROM waiting`)
        blocked = Number(state?.n)
        if (blocked >= minimum) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect(blocked).toBeGreaterThanOrEqual(minimum)
    }
    let outcomes: PromiseSettledResult<unknown>[] = []
    try {
      await waitForBlocked(1)
      operations.push(
        paymentService.cancel(
          { userId: ownerId, notifications: paymentNotifications },
          b.paymentId!,
          { orgId },
        ),
      )
      await waitForBlocked(2)
    } finally {
      unlock()
      outcomes = await Promise.allSettled(operations)
    }

    expect(outcomes[1]?.status).toBe('fulfilled')
    if (outcomes[2]?.status === 'rejected') {
      expect(outcomes[2].reason?.cause?.code).not.toBe('40P01')
      expect(String(outcomes[2].reason?.message)).toMatch(/not pending/i)
    }
    const [finishedEvent] = await db.select().from(events).where(eq(events.id, ev.id))
    const [finishedBooking] = await db.select().from(bookings).where(eq(bookings.id, b.id))
    const [finishedPayment] = await db.select().from(payments).where(eq(payments.id, b.paymentId!))
    expect(finishedEvent?.status).toBe('cancelled')
    expect(finishedBooking?.status).toBe('cancelled')
    expect(finishedPayment?.status).toBe('cancelled')
    expect(await incomes(b.paymentId!)).toHaveLength(0)
    expect(eventNotifications).toHaveLength(1)
    expect(paymentNotifications).toHaveLength(0)

    const nextEvent = await paidEvent()
    const nextBooking = await bookingService.book(
      { userId: await newPlayer() },
      orgId,
      nextEvent.id,
      { method: 'cash' },
    )
    const secondPaymentNotifications = createNotificationCollector()
    const secondEventNotifications = createNotificationCollector()
    await paymentService.cancel(
      { userId: ownerId, notifications: secondPaymentNotifications },
      nextBooking.paymentId!,
      { orgId },
    )
    await expect(
      paymentService.cancel(
        { userId: ownerId, notifications: secondPaymentNotifications },
        nextBooking.paymentId!,
        { orgId },
      ),
    ).rejects.toThrow(/not pending/i)
    expect(secondPaymentNotifications).toHaveLength(1)
    expect(await incomes(nextBooking.paymentId!)).toHaveLength(0)
    await eventService.cancel(
      { userId: ownerId, notifications: secondEventNotifications },
      nextEvent.id,
    )
    const [secondEvent] = await db.select().from(events).where(eq(events.id, nextEvent.id))
    const [secondBooking] = await db.select().from(bookings).where(eq(bookings.id, nextBooking.id))
    const [secondPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, nextBooking.paymentId!))
    expect(secondEvent?.status).toBe('cancelled')
    expect(secondBooking?.status).toBe('cancelled')
    expect(secondPayment?.status).toBe('cancelled')
    expect(await incomes(nextBooking.paymentId!)).toHaveLength(0)
    expect(secondPaymentNotifications).toHaveLength(1)
    expect(secondEventNotifications).toHaveLength(0)
  })

  it('6.8.4: rejecting payment frees the spot and promotes waitlist', async () => {
    const ev = await paidEvent(1)
    const b1 = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
      method: 'cash',
    })
    const p2 = await newPlayer()
    const w2 = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'cash' })
    expect(w2.status).toBe('waitlisted')
    await paymentService.cancel({ userId: ownerId }, b1.paymentId!, { orgId })
    const promoted = await bookingService.getById({ userId: ownerId }, w2.id)
    expect(promoted.status).toBe('pending_payment')
    expect(promoted.paymentId).not.toBeNull()
    expect((await bookingService.getById({ userId: ownerId }, b1.id)).status).toBe('cancelled')
  })

  it('6.8.5: rejecting a stale payment does not cancel the new booking', async () => {
    const ev = await paidEvent()
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
    const stalePaymentId = b.paymentId!
    // имитируем данные v0.1.0: бронь отменена, pending-платёж остался висеть
    await db.update(payments).set({ status: 'pending' }).where(eq(payments.id, stalePaymentId))
    await bookingService.cancel({ userId: pid }, b.id)
    await db.update(payments).set({ status: 'pending' }).where(eq(payments.id, stalePaymentId))
    const again = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'transfer' })
    await paymentService.confirm({ userId: ownerId }, again.paymentId!, { orgId })
    await paymentService.cancel({ userId: ownerId }, stalePaymentId, { orgId })
    expect((await bookingService.getById({ userId: ownerId }, again.id)).status).toBe('confirmed')
  })

  it('6.8.6: cancelling a booking cancels its pending payment', async () => {
    const ev = await paidEvent()
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
    await bookingService.cancel({ userId: pid }, b.id)
    const [p] = await db.select().from(payments).where(eq(payments.id, b.paymentId!))
    expect(p!.status).toBe('cancelled')
  })

  it('6.8.1: confirm scoped by organization', async () => {
    const [o2] = await db.insert(users).values({ email: 'mr-o2@t.by' }).returning()
    fixtureUsers.push(o2!.id)
    const org2 = await organizationService.create({ userId: o2!.id }, { name: 'Other' })
    fixtureOrgs.push(org2.id)
    const ev = await paidEvent()
    const b = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
      method: 'cash',
    })
    await expect(
      paymentService.confirm({ userId: o2!.id }, b.paymentId!, { orgId: org2.id }),
    ).rejects.toThrow(/not found/i)
  })

  it('6.8.9: payments.user_id RESTRICT; manual income counts in balance', async () => {
    const { ledgerService } = await import('../ledger/service')
    const ev = await paidEvent()
    const pid = await newPlayer()
    await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
    await expect(db.delete(users).where(eq(users.id, pid))).rejects.toThrow()
    await ledgerService.addIncome({ userId: ownerId }, orgId, {
      category: 'donation',
      amount: 2500,
      description: 'Взнос на мячи',
    })
    // категории из 6.9.1
    await ledgerService.addIncome({ userId: ownerId }, orgId, {
      category: 'contribution',
      amount: 1000,
    })
    await ledgerService.addIncome({ userId: ownerId }, orgId, {
      category: 'carryover',
      amount: 500,
    })
    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance).toMatchObject({ currency: 'BYN', income: 4000, balance: 4000 })
  })

  it('6.8.10: booking cancel vs confirm race + ledger invariants (5 runs)', async () => {
    const { ledgerService } = await import('../ledger/service')
    for (let run = 0; run < 5; run++) {
      const ev = await paidEvent()
      const pid = await newPlayer()
      const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
      await Promise.allSettled([
        bookingService.cancel({ userId: pid }, b.id),
        paymentService.confirm({ userId: ownerId }, b.paymentId!, { orgId }),
      ])
      const [p] = await db.select().from(payments).where(eq(payments.id, b.paymentId!))
      const booking = await bookingService.getById({ userId: ownerId }, b.id)
      const entries = await incomes(b.paymentId!)
      // ровно один исход: либо оплачено (1 доход), либо отменено (0 доходов)
      expect(['succeeded', 'cancelled']).toContain(p!.status)
      expect(entries.filter((e) => e.type === 'income')).toHaveLength(
        p!.status === 'succeeded' ? 1 : 0,
      )
      expect(booking.status).toBe('cancelled')
    }
    // инвариант кассы: доход = Σ succeeded + Σ refunded; расходы-возвраты = Σ refunded
    const all = await db.select().from(payments).where(eq(payments.organizationId, orgId))
    const paid = all.filter((x) => x.status === 'succeeded' || x.status === 'refunded')
    const refunded = all.filter((x) => x.status === 'refunded')
    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    const sum = (xs: typeof all) => xs.reduce((a, x) => a + x.amount, 0)
    expect(balance.income).toBe(sum(paid))
    expect(balance.expense).toBe(sum(refunded))
    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId))
    expect(subs.every((x) => x.usedSessions >= 0 && x.usedSessions <= x.totalSessions)).toBe(true)
  })

  afterAll(async () => {
    await closeDb()
  })
})
