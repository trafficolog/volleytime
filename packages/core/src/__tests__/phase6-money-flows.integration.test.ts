import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { ledgerService } from '../ledger/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'
import { planService } from '../subscription-plans/service'
import { subscriptionService } from '../subscriptions/service'

let ownerId: number
let orgId: number

const future = (h = 24) => new Date(Date.now() + h * 3600_000)

async function newPlayer() {
  const [u] = await db
    .insert(users)
    .values({ email: `m6-${Math.random()}@t.by` })
    .returning()
  await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
  return u!.id
}

describe('Phase 6 — money flows (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Money Org' })
    orgId = org.id
  })

  it('FULL: training day — 3 players pay cash, organizer pays rent, balance correct', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Тренировка',
      startsAt: future(),
      endsAt: future(26),
      capacity: 10,
      price: 1500,
    })
    // 3 игрока записались и оплатили
    for (let i = 0; i < 3; i++) {
      const pid = await newPlayer()
      const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
      await paymentService.confirm({ userId: ownerId }, b.paymentId!)
    }
    // организатор оплатил аренду 30.00
    await ledgerService.addExpense({ userId: ownerId }, orgId, {
      category: 'rent',
      amount: 3000,
      description: 'Аренда зала',
    })

    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.income).toBe(4500) // 3 × 15.00
    expect(balance.expense).toBe(3000)
    expect(balance.balance).toBe(1500) // 15.00 остаток
  })

  it('FULL: player cancels paid booking → refund → balance net zero', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Отказ',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 2000,
    })
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
    await paymentService.confirm({ userId: ownerId }, b.paymentId!)
    expect((await ledgerService.getBalance({ userId: ownerId }, orgId)).balance).toBe(2000)

    // игрок отменяет; организатор возвращает деньги
    await bookingService.cancel({ userId: pid }, b.id)
    await paymentService.refund({ userId: ownerId }, b.paymentId!, 'Отмена игроком')

    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.balance).toBe(0)
  })

  it('FULL: subscription purchase paid → subscription activated', async () => {
    const plan = await planService.create(
      { userId: ownerId },
      {
        organizationId: orgId,
        name: 'Абонемент 8',
        totalSessions: 8,
        price: 8000,
      },
    )
    const pid = await newPlayer()
    // покупка без авто-активации (ждёт оплаты)
    const sub = await subscriptionService.createFromPlan({ userId: pid }, orgId, plan.id)
    expect(sub.status).toBe('pending')

    const payment = await paymentService.createForSubscription(
      { userId: pid },
      {
        organizationId: orgId,
        userId: pid,
        subscriptionId: sub.id,
        amount: plan.price,
        currency: 'BYN',
        method: 'cash',
      },
    )
    await paymentService.confirm({ userId: ownerId }, payment.id)

    const activated = await subscriptionService.getById({ userId: pid }, sub.id)
    expect(activated.status).toBe('active')
    expect((await ledgerService.getBalance({ userId: ownerId }, orgId)).income).toBe(8000)
  })

  it('INVARIANT: ledger is append-only — balance equals SUM of entries', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Инвариант',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 1000,
    })
    const pid = await newPlayer()
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
    await paymentService.confirm({ userId: ownerId }, b.paymentId!)
    await ledgerService.addExpense({ userId: ownerId }, orgId, {
      category: 'equipment',
      amount: 400,
    })
    await paymentService.refund({ userId: ownerId }, b.paymentId!)

    const entries = await ledgerService.listHistory({ userId: ownerId }, orgId, { limit: 200 })
    const computed = entries.reduce(
      (acc, e) => acc + (e.type === 'income' ? e.amount : -e.amount),
      0,
    )
    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.balance).toBe(computed)
    expect(entries).toHaveLength(3) // income + expense + refund — ничего не удалено
  })

  it('SECURITY: payment of another org is isolated', async () => {
    const [u2] = await db
      .insert(users)
      .values({ email: `o2-${Math.random()}@t.by` })
      .returning()
    const otherOrg = await organizationService.create({ userId: u2!.id }, { name: 'Other' })
    const otherEv = await eventService.create({ userId: u2!.id }, otherOrg.id, {
      title: 'Чужое',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 1000,
    })
    await memberService
      .add({ userId: u2!.id }, { organizationId: otherOrg.id, userId: u2!.id })
      .catch(() => {})
    const [p] = await db
      .insert(users)
      .values({ email: `p-${Math.random()}@t.by` })
      .returning()
    await memberService.add({ userId: u2!.id }, { organizationId: otherOrg.id, userId: p!.id })
    const b = await bookingService.book({ userId: p!.id }, otherOrg.id, otherEv.id, {
      method: 'cash',
    })

    // платёж принадлежит другой организации
    const payment = await paymentService.getById({ userId: ownerId }, b.paymentId!)
    expect(payment.organizationId).toBe(otherOrg.id)
    expect(payment.organizationId).not.toBe(orgId)

    // касса нашей org не затронута
    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.income).toBe(0)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
