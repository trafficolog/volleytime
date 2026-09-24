import { closeDb, db, eq, organizations, payments, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'
import { planService } from '../subscription-plans/service'

import { NoActiveSubscriptionError } from './errors'
import { subscriptionService } from './service'

let ownerId: number
let orgId: number
let playerId: number

async function makePlan(sessions = 8, validityDays: number | null = 60) {
  return planService.create(
    { userId: ownerId },
    {
      organizationId: orgId,
      name: 'Абонемент',
      totalSessions: sessions,
      validityDays,
      price: 8000,
    },
  )
}

describe('subscriptionService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [o] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = o!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Sub Org' })
    orgId = org.id
    const [p] = await db
      .insert(users)
      .values({ email: `p-${Math.random()}@t.by` })
      .returning()
    playerId = p!.id
  })

  it('SECURITY: purchase of paid plan → pending + payment, not active (5.13.1)', async () => {
    const plan = await makePlan()
    const { subscription, paymentId } = await subscriptionService.purchase(
      { userId: playerId },
      orgId,
      plan.id,
      { method: 'cash' },
    )
    expect(subscription.status).toBe('pending')
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId!) })
    expect(payment).toMatchObject({
      status: 'pending',
      amount: 8000,
      subscriptionId: subscription.id,
    })
    await expect(subscriptionService.consumeSession({ userId: playerId }, orgId)).rejects.toThrow(
      NoActiveSubscriptionError,
    )
    await expect(
      subscriptionService.purchase({ userId: playerId }, orgId, plan.id, { method: 'cash' }),
    ).rejects.toThrow(/unpaid subscription/)
  })

  it('listMineDetailed includes plan name and pending payment (5.13.20)', async () => {
    const plan = await makePlan()
    await subscriptionService.purchase({ userId: playerId }, orgId, plan.id, { method: 'transfer' })
    const [mine] = await subscriptionService.listMineDetailed({ userId: playerId }, orgId)
    expect(mine!.plan.name).toBe('Абонемент')
    expect(mine!.pendingPayment).toMatchObject({ amount: 8000, method: 'transfer' })
    expect(mine!.usage).toEqual([])
  })

  it('DoD 7: paid purchase → confirm payment → active with plan validity (6.8.3)', async () => {
    const { paymentService } = await import('../payments/service')
    const plan = await makePlan(8, 30)
    const { subscription, paymentId } = await subscriptionService.purchase(
      { userId: playerId },
      orgId,
      plan.id,
      { method: 'cash' },
    )
    await paymentService.confirm({ userId: ownerId }, paymentId!, { orgId })
    const active = await subscriptionService.getById({ userId: playerId }, subscription.id)
    expect(active.status).toBe('active')
    const days = (active.expiresAt!.getTime() - Date.now()) / 86400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)
  })

  it('rejects new purchases while off and preserves a pending purchase for confirmation', async () => {
    const { paymentService } = await import('../payments/service')
    const plan = await makePlan()
    const { subscription, paymentId } = await subscriptionService.purchase(
      { userId: playerId },
      orgId,
      plan.id,
      { method: 'cash' },
    )
    await organizationService.update({ userId: ownerId }, orgId, { subscriptionsEnabled: false })
    await expect(
      subscriptionService.purchase({ userId: playerId }, orgId, plan.id, { method: 'cash' }),
    ).rejects.toMatchObject({ code: 'organization.subscriptions_disabled' })
    await paymentService.confirm({ userId: ownerId }, paymentId!, { orgId })
    expect((await subscriptionService.getById({ userId: playerId }, subscription.id)).status).toBe(
      'active',
    )
    expect(
      (await subscriptionService.listMineDetailed({ userId: playerId }, orgId)).map((s) => s.id),
    ).toContain(subscription.id)
    await organizationService.update({ userId: ownerId }, orgId, { subscriptionsEnabled: true })
    expect(
      (await subscriptionService.consumeSession({ userId: playerId }, orgId, subscription.id))
        .usedSessions,
    ).toBe(1)
  })

  it('reject payment cancels only pending subscription (6.8.3)', async () => {
    const { paymentService } = await import('../payments/service')
    const plan = await makePlan()
    const { subscription, paymentId } = await subscriptionService.purchase(
      { userId: playerId },
      orgId,
      plan.id,
      { method: 'transfer' },
    )
    await paymentService.cancel({ userId: ownerId }, paymentId!, { orgId })
    expect((await subscriptionService.getById({ userId: playerId }, subscription.id)).status).toBe(
      'cancelled',
    )
  })

  it('purchase of free plan activates immediately', async () => {
    const plan = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Пробный', totalSessions: 1, price: 0 },
    )
    const { subscription, paymentId } = await subscriptionService.purchase(
      { userId: playerId },
      orgId,
      plan.id,
      { method: 'cash' },
    )
    expect(subscription.status).toBe('active')
    expect(paymentId).toBeNull()
  })

  it('activate only pending → active; repeated activate → not_pending (5.13.14)', async () => {
    const plan = await makePlan()
    const sub = await subscriptionService.createFromPlan({ userId: playerId }, orgId, plan.id, {
      autoActivate: true,
    })
    await expect(subscriptionService.activate({ userId: ownerId }, sub.id)).rejects.toThrow(
      /not pending/,
    )
  })

  it('createFromPlan is pending', async () => {
    const plan = await makePlan()
    const sub = await subscriptionService.createFromPlan({ userId: playerId }, orgId, plan.id)
    expect(sub.status).toBe('pending')
    expect(sub.totalSessions).toBe(8)
  })

  it('autoActivate sets active + expiresAt', async () => {
    const plan = await makePlan(8, 30)
    const sub = await subscriptionService.createFromPlan({ userId: playerId }, orgId, plan.id, {
      autoActivate: true,
    })
    expect(sub.status).toBe('active')
    expect(sub.activatedAt).toBeInstanceOf(Date)
    expect(sub.expiresAt).toBeInstanceOf(Date)
  })

  it('consumeSession decrements remaining', async () => {
    const plan = await makePlan(3)
    const sub = await subscriptionService.createFromPlan({ userId: playerId }, orgId, plan.id, {
      autoActivate: true,
    })
    const after = await subscriptionService.consumeSession({ userId: playerId }, orgId, sub.id)
    expect(after.usedSessions).toBe(1)
  })

  it('consume to exhaustion sets status=exhausted', async () => {
    const plan = await makePlan(2)
    const sub = await subscriptionService.createFromPlan({ userId: playerId }, orgId, plan.id, {
      autoActivate: true,
    })
    await subscriptionService.consumeSession({ userId: playerId }, orgId, sub.id)
    const last = await subscriptionService.consumeSession({ userId: playerId }, orgId, sub.id)
    expect(last.status).toBe('exhausted')
    await expect(
      subscriptionService.consumeSession({ userId: playerId }, orgId, sub.id),
    ).rejects.toThrow(NoActiveSubscriptionError)
  })

  it('CONCURRENCY: parallel consume never exceeds total', async () => {
    const plan = await makePlan(3)
    const sub = await subscriptionService.createFromPlan({ userId: playerId }, orgId, plan.id, {
      autoActivate: true,
    })
    // 8 параллельных списаний на 3 сессии
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        subscriptionService.consumeSession({ userId: playerId }, orgId, sub.id),
      ),
    )
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    expect(succeeded).toBe(3) // ровно 3, никогда больше
    const final = await subscriptionService.getById({ userId: playerId }, sub.id)
    expect(final.usedSessions).toBe(3)
  })

  it('FIFO: consumes subscription expiring first', async () => {
    const plan = await makePlan(5, 10)
    const subA = await subscriptionService.createFromPlan({ userId: playerId }, orgId, plan.id, {
      autoActivate: true,
    })
    const subB = await subscriptionService.createFromPlan({ userId: playerId }, orgId, plan.id, {
      autoActivate: true,
    })
    // сделать subA истекающим раньше
    const { subscriptions } = await import('@volley-time/db')
    const { eq } = await import('@volley-time/db')
    await db
      .update(subscriptions)
      .set({ expiresAt: new Date(Date.now() + 1000) })
      .where(eq(subscriptions.id, subA.id))
    await db
      .update(subscriptions)
      .set({ expiresAt: new Date(Date.now() + 100000) })
      .where(eq(subscriptions.id, subB.id))
    // FIFO без указания id → должен взять subA (истекает раньше)
    await subscriptionService.consumeSession({ userId: playerId }, orgId)
    const a = await subscriptionService.getById({ userId: playerId }, subA.id)
    expect(a.usedSessions).toBe(1)
  })

  it('restoreSession increments back + revives exhausted', async () => {
    const plan = await makePlan(1)
    const sub = await subscriptionService.createFromPlan({ userId: playerId }, orgId, plan.id, {
      autoActivate: true,
    })
    const exhausted = await subscriptionService.consumeSession({ userId: playerId }, orgId, sub.id)
    expect(exhausted.status).toBe('exhausted')
    const restored = await subscriptionService.restoreSession({ userId: playerId }, sub.id)
    expect(restored.usedSessions).toBe(0)
    expect(restored.status).toBe('active')
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
