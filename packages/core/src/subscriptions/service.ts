import {
  and,
  asc,
  bookings,
  desc,
  eq,
  events,
  gt,
  inArray,
  isNull,
  or,
  payments,
  sql,
  subscriptionPlans,
  subscriptions,
  type Subscription,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'
import { PlanNotAvailableError } from '../subscription-plans/errors'

import {
  NoActiveSubscriptionError,
  NotEnoughSessionsError,
  SubscriptionNotFoundError,
  SubscriptionNotPendingError,
  SubscriptionPendingExistsError,
} from './errors'

export const subscriptionService = {
  /**
   * Покупка абонемента игроком (Task 5.13.1). Платный план → pending + pending-платёж
   * (активация только при подтверждении оплаты, 6.8.3); бесплатный → сразу active.
   */
  async purchase(
    ctx: ServiceContext,
    orgId: number,
    planId: number,
    opts: { method: 'cash' | 'transfer' },
  ): Promise<{ subscription: Subscription; paymentId: number | null }> {
    return inTransaction(ctx, async (tx) => {
      await organizationService.requireSubscriptionsEnabled(tx, orgId)
      const db = getDb(tx)
      const plan = await db.query.subscriptionPlans.findFirst({
        where: and(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.organizationId, orgId)),
      })
      if (!plan || plan.status !== 'active') throw new PlanNotAvailableError()

      if (plan.price === 0) {
        const sub = await this.createFromPlan(tx, orgId, planId, { autoActivate: true })
        return { subscription: sub, paymentId: null }
      }

      // сериализуем покупки пользователя по плану (нет двух неоплаченных)
      await db.execute(sql`SELECT pg_advisory_xact_lock(${planId}, ${ctx.userId})`)
      const pendingExists = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.userId, ctx.userId),
          eq(subscriptions.planId, planId),
          eq(subscriptions.status, 'pending'),
        ),
        columns: { id: true },
      })
      if (pendingExists) throw new SubscriptionPendingExistsError()

      const sub = await this.createFromPlan(tx, orgId, planId)
      const payment = await paymentService.createForSubscription(
        { ...tx },
        {
          organizationId: orgId,
          userId: ctx.userId,
          subscriptionId: sub.id,
          amount: plan.price,
          currency: plan.currency,
          method: opts.method,
        },
      )
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.SUBSCRIPTION_PURCHASED,
        entityType: 'subscription',
        entityId: sub.id,
        newValue: { planId, price: plan.price, paymentId: payment.id },
      })
      return { subscription: sub, paymentId: payment.id }
    })
  },

  /**
   * Создать subscription из плана (status=pending). autoActivate → сразу active.
   * Внутренний метод: выдача без оплаты только для бесплатных планов и тестов (не вызывать из API).
   */
  async createFromPlan(
    ctx: ServiceContext,
    orgId: number,
    planId: number,
    opts: { autoActivate?: boolean } = {},
  ): Promise<Subscription> {
    const db = getDb(ctx)
    const plan = await db.query.subscriptionPlans.findFirst({
      where: and(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.organizationId, orgId)),
    })
    if (!plan || plan.status !== 'active') throw new PlanNotAvailableError()

    const [sub] = await db
      .insert(subscriptions)
      .values({
        organizationId: orgId,
        userId: ctx.userId,
        planId: plan.id,
        totalSessions: plan.totalSessions,
        status: 'pending',
      })
      .returning()

    if (opts.autoActivate) {
      return this.activate(ctx, sub!.id, { validityDays: plan.validityDays })
    }
    return sub!
  },

  /** Активировать (pending→active). Устанавливает expiresAt из validityDays. */
  async activate(
    ctx: ServiceContext,
    subscriptionId: number,
    opts: { validityDays?: number | null } = {},
  ): Promise<Subscription> {
    const db = getDb(ctx)
    const sub = await this.getById(ctx, subscriptionId)
    const expiresAt =
      opts.validityDays != null
        ? new Date(Date.now() + opts.validityDays * 24 * 60 * 60 * 1000)
        : null
    // только pending → active (5.13.14): exhausted/cancelled не переактивируются, срок не сдвигается
    const [activated] = await db
      .update(subscriptions)
      .set({ status: 'active', activatedAt: new Date(), expiresAt, updatedAt: new Date() })
      .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.status, 'pending')))
      .returning()
    if (!activated) throw new SubscriptionNotPendingError()
    await auditService.record(ctx, {
      organizationId: sub.organizationId,
      action: AUDIT_ACTIONS.SUBSCRIPTION_ACTIVATED,
      entityType: 'subscription',
      entityId: subscriptionId,
      newValue: { expiresAt },
    })
    return activated!
  },

  async getById(ctx: ServiceContext, id: number): Promise<Subscription> {
    const s = await getDb(ctx).query.subscriptions.findFirst({ where: eq(subscriptions.id, id) })
    if (!s) throw new SubscriptionNotFoundError(id)
    return s
  },

  /**
   * Атомарно списать 1 сессию. Выбор конкретного subscription (subscriptionId) или
   * FIFO (первый active с остатком, по expiresAt). Concurrency-safe: WHERE used < total.
   */
  async consumeSession(
    ctx: ServiceContext,
    orgId: number,
    subscriptionId?: number,
  ): Promise<Subscription> {
    return this.consumeSessions(ctx, orgId, 1, subscriptionId)
  },

  /**
   * Атомарно списать `count` занятий с **одного** абонемента (20.1.2, ADR: одно занятие на место).
   * FIFO по expiresAt выбирает первый абонемент, где хватает `count`; без дробления по нескольким.
   * Нет активного абонемента — `subscription.no_active`; есть, но ни в одном не хватает —
   * `subscription.not_enough_sessions` (409). Условие повторяется в UPDATE (гонка списаний).
   */
  async consumeSessions(
    ctx: ServiceContext,
    orgId: number,
    count: number,
    subscriptionId?: number,
  ): Promise<Subscription> {
    if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be >= 1')
    const db = getDb(ctx)
    const now = new Date()

    // единое условие для обеих веток (Task 5.13.5): свой, этой организации, active, не истёк, есть остаток
    const active = and(
      eq(subscriptions.userId, ctx.userId),
      eq(subscriptions.organizationId, orgId),
      eq(subscriptions.status, 'active'),
      sql`${subscriptions.usedSessions} < ${subscriptions.totalSessions}`,
      or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now)),
      subscriptionId ? eq(subscriptions.id, subscriptionId) : undefined,
    )
    const usable = and(
      active,
      sql`${subscriptions.usedSessions} + ${count} <= ${subscriptions.totalSessions}`,
    )
    const shortage = async () => {
      if (count === 1) return new NoActiveSubscriptionError()
      const any = await db.query.subscriptions.findFirst({ where: active, columns: { id: true } })
      return any ? new NotEnoughSessionsError(count) : new NoActiveSubscriptionError()
    }
    const candidate = await db.query.subscriptions.findFirst({
      where: usable,
      orderBy: [asc(subscriptions.expiresAt), asc(subscriptions.id)],
    })

    if (!candidate) throw await shortage()

    // atomic consume: условие повторяется в UPDATE (гонка с другим списанием или истечением)
    const [updated] = await db
      .update(subscriptions)
      .set({ usedSessions: sql`${subscriptions.usedSessions} + ${count}`, updatedAt: new Date() })
      .where(and(eq(subscriptions.id, candidate.id), usable))
      .returning()

    if (!updated) throw await shortage() // гонка проиграна

    // exhausted если исчерпан
    if (updated.usedSessions >= updated.totalSessions) {
      const [exhausted] = await db
        .update(subscriptions)
        .set({ status: 'exhausted', updatedAt: new Date() })
        .where(eq(subscriptions.id, updated.id))
        .returning()
      return exhausted!
    }
    return updated
  },

  /** Восстановить 1 сессию (при отмене брони). Возвращает exhausted→active если был. */
  async restoreSession(ctx: ServiceContext, subscriptionId: number): Promise<Subscription> {
    return this.restoreSessions(ctx, subscriptionId, 1)
  },

  /** Восстановить `count` занятий (отмена записи или её мест, 20.1.2). exhausted→active. */
  async restoreSessions(
    ctx: ServiceContext,
    subscriptionId: number,
    count: number,
  ): Promise<Subscription> {
    if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be >= 1')
    const db = getDb(ctx)
    const [restored] = await db
      .update(subscriptions)
      .set({
        usedSessions: sql`GREATEST(${subscriptions.usedSessions} - ${count}, 0)`,
        status: sql`CASE WHEN ${subscriptions.status} = 'exhausted' THEN 'active' ELSE ${subscriptions.status} END`,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscriptionId))
      .returning()
    if (!restored) throw new SubscriptionNotFoundError(subscriptionId)
    return restored
  },

  /**
   * Мои абонементы с планом, неоплаченным платежом и историей списаний (Task 5.13.20).
   */
  async listMineDetailed(ctx: ServiceContext, orgId: number) {
    const db = getDb(ctx)
    const subs = await this.listMine(ctx, orgId)
    if (subs.length === 0) return []
    const ids = subs.map((s) => s.id)
    const plans = await db
      .select({ id: subscriptionPlans.id, name: subscriptionPlans.name })
      .from(subscriptionPlans)
      .where(inArray(subscriptionPlans.id, [...new Set(subs.map((s) => s.planId))]))
    const pending = await db
      .select({
        subscriptionId: payments.subscriptionId,
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        method: payments.method,
      })
      .from(payments)
      .where(and(inArray(payments.subscriptionId, ids), eq(payments.status, 'pending')))
    const usage = await db
      .select({
        subscriptionId: bookings.subscriptionId,
        bookingId: bookings.id,
        status: bookings.status,
        seats: bookings.seats,
        eventTitle: events.title,
        startsAt: events.startsAt,
      })
      .from(bookings)
      .innerJoin(events, eq(events.id, bookings.eventId))
      .where(
        and(
          inArray(bookings.subscriptionId, ids),
          inArray(bookings.status, ['confirmed', 'attended', 'no_show']),
        ),
      )
      .orderBy(desc(events.startsAt))
    const planName = new Map(plans.map((p) => [p.id, p.name]))
    return subs.map((s) => ({
      ...s,
      plan: { id: s.planId, name: planName.get(s.planId) ?? 'Абонемент' },
      pendingPayment: pending.find((p) => p.subscriptionId === s.id) ?? null,
      usage: usage
        .filter((u) => u.subscriptionId === s.id)
        .map((u) => ({
          bookingId: u.bookingId,
          status: u.status,
          seats: u.seats,
          eventTitle: u.eventTitle,
          startsAt: u.startsAt,
        })),
    }))
  },

  async listMine(ctx: ServiceContext, orgId: number): Promise<Subscription[]> {
    return getDb(ctx).query.subscriptions.findMany({
      where: and(eq(subscriptions.userId, ctx.userId), eq(subscriptions.organizationId, orgId)),
      orderBy: (s, { desc }) => [desc(s.purchasedAt)],
    })
  },
}
