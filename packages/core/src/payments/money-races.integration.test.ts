import {
  closeDb,
  db,
  eq,
  ledgerEntries,
  organizations,
  payments,
  subscriptions,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

import { paymentService } from './service'

/** Денежные гонки из ревью v0.1.0 (6.8.1, 6.8.2, 6.8.10). */
describe('money races (integration)', () => {
  let ownerId: number
  let orgId: number
  const newPlayer = async () => {
    const [u] = await db
      .insert(users)
      .values({ email: `mr-${Math.random()}@t.by` })
      .returning()
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
    await db.delete(organizations)
    await db.delete(users)
    const [o] = await db.insert(users).values({ email: 'mr-owner@t.by' }).returning()
    ownerId = o!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Money Races' })).id
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

  it('6.8.1: confirm vs reject — one wins, state consistent', async () => {
    const ev = await paidEvent()
    const b = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
      method: 'cash',
    })
    const results = await Promise.allSettled([
      paymentService.confirm({ userId: ownerId }, b.paymentId!, { orgId }),
      paymentService.cancel({ userId: ownerId }, b.paymentId!, { orgId }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const [p] = await db.select().from(payments).where(eq(payments.id, b.paymentId!))
    const income = await incomes(b.paymentId!)
    expect(income.length).toBe(p!.status === 'succeeded' ? 1 : 0)
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
    const org2 = await organizationService.create({ userId: o2!.id }, { name: 'Other' })
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
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
