import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { ledgerService } from '../ledger/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'
import { planService } from '../subscription-plans/service'
import { subscriptionService } from '../subscriptions/service'

import { eventService } from './service'

let ownerId: number
let orgId: number

const future = (h = 24) => new Date(Date.now() + h * 3600_000)

async function newPlayer() {
  const [u] = await db
    .insert(users)
    .values({ email: `mr-${Math.random()}@t.by` })
    .returning()
  await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
  return u!.id
}

describe('event cancel — mass refund (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Refund Org' })
    orgId = org.id
  })

  it('cancels all bookings on event cancel', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Отменяемое',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 0,
    })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    const b1 = await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })
    const b2 = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'free' })

    await eventService.cancel({ userId: ownerId }, ev.id)

    expect((await bookingService.getById({ userId: ownerId }, b1.id)).status).toBe('cancelled')
    expect((await bookingService.getById({ userId: ownerId }, b2.id)).status).toBe('cancelled')
  })

  it('NET ZERO: paid bookings refunded → ledger balance back to 0', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Платное',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 2000,
    })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    const b1 = await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'cash' })
    const b2 = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'cash' })
    // оба оплатили
    await paymentService.confirm({ userId: ownerId }, b1.paymentId!)
    await paymentService.confirm({ userId: ownerId }, b2.paymentId!)
    expect((await ledgerService.getBalance({ userId: ownerId }, orgId)).balance).toBe(4000)

    await eventService.cancel({ userId: ownerId }, ev.id)

    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.income).toBe(4000)
    expect(balance.expense).toBe(4000)
    expect(balance.balance).toBe(0) // критичный инвариант
  })

  it('pending payments cancelled (no ledger impact)', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Неоплаченное',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 1500,
    })
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })

    await eventService.cancel({ userId: ownerId }, ev.id)

    const payment = await paymentService.getById({ userId: ownerId }, b.paymentId!)
    expect(payment.status).toBe('cancelled')
    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.balance).toBe(0) // не было дохода — нет и расхода
  })

  it('subscription sessions restored on event cancel', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Абонементное',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 1500,
    })
    const pid = await newPlayer()
    const plan = await planService.create(
      { userId: ownerId },
      {
        organizationId: orgId,
        name: 'Абонемент',
        totalSessions: 5,
      },
    )
    const sub = await subscriptionService.createFromPlan({ userId: pid }, orgId, plan.id, {
      autoActivate: true,
    })
    await bookingService.book({ userId: pid }, orgId, ev.id, {
      method: 'subscription',
      subscriptionId: sub.id,
    })
    expect((await subscriptionService.getById({ userId: pid }, sub.id)).usedSessions).toBe(1)

    await eventService.cancel({ userId: ownerId }, ev.id)

    expect((await subscriptionService.getById({ userId: pid }, sub.id)).usedSessions).toBe(0)
  })

  it('idempotent: double cancel does not double-refund', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Дубль',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 1000,
    })
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
    await paymentService.confirm({ userId: ownerId }, b.paymentId!)

    await eventService.cancel({ userId: ownerId }, ev.id)
    await eventService.cancel({ userId: ownerId }, ev.id) // повторно

    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.expense).toBe(1000) // ровно один refund
  })

  it('waitlisted bookings also cancelled (no refund needed)', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'С очередью',
      startsAt: future(),
      endsAt: future(26),
      capacity: 1,
      price: 0,
    })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })
    const b2 = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'free' })
    expect(b2.status).toBe('waitlisted')

    await eventService.cancel({ userId: ownerId }, ev.id)
    expect((await bookingService.getById({ userId: ownerId }, b2.id)).status).toBe('cancelled')
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
