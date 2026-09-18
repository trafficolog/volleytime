import {
  and,
  asc,
  bookings,
  eq,
  events,
  inArray,
  organizationMembers,
  payments,
  subscriptionPlans,
  subscriptions,
  users,
  type Payment,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'

import { ledgerService } from '../ledger/service'
import { collectNotification } from '../notifier/collect'
import { getDb, type ServiceContext } from '../shared/context'

import { PaymentNotFoundError, PaymentNotPendingError, PaymentNotSucceededError } from './errors'

/**
 * Условный переход статуса платежа (Task 6.8.1): `WHERE status = from [AND organization_id]`.
 * 0 строк → точная ошибка. Возвращает платёж ДО перехода и после.
 */
async function transitionPayment(
  db: ReturnType<typeof getDb>,
  paymentId: number,
  from: Payment['status'],
  set: Partial<typeof payments.$inferInsert>,
  orgId?: number,
): Promise<Payment> {
  const conds = [eq(payments.id, paymentId), eq(payments.status, from)]
  if (orgId !== undefined) conds.push(eq(payments.organizationId, orgId))
  const [updated] = await db
    .update(payments)
    .set(set)
    .where(and(...conds))
    .returning()
  if (updated) return updated
  const existing = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
  if (!existing || (orgId !== undefined && existing.organizationId !== orgId)) {
    throw new PaymentNotFoundError(paymentId)
  }
  throw from === 'succeeded' ? new PaymentNotSucceededError() : new PaymentNotPendingError()
}

/** Контекст платежа для уведомлений (8.8.5): событие или план абонемента. */
async function paymentContext(
  db: ReturnType<typeof getDb>,
  payment: Payment,
): Promise<{ eventTitle?: string; eventDate?: string; eventId?: number; planName?: string }> {
  if (payment.bookingId) {
    const [row] = await db
      .select({ id: events.id, title: events.title, startsAt: events.startsAt })
      .from(bookings)
      .innerJoin(events, eq(events.id, bookings.eventId))
      .where(eq(bookings.id, payment.bookingId))
      .limit(1)
    if (row) {
      return { eventTitle: row.title, eventDate: row.startsAt.toISOString(), eventId: row.id }
    }
  }
  if (payment.subscriptionId) {
    const [row] = await db
      .select({ name: subscriptionPlans.name })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
      .where(eq(subscriptions.id, payment.subscriptionId))
      .limit(1)
    if (row) return { planName: row.name }
  }
  return {}
}

/**
 * Уведомить управляющих организации о новом pending-платеже (Task 8.8.6).
 * Собирается в транзакции, отправляется после коммита.
 */
async function notifyOrganizersAboutPending(
  ctx: ServiceContext,
  payment: Payment,
  extra: { eventTitle?: string; eventDate?: string; eventId?: number; planName?: string } = {},
): Promise<void> {
  const db = getDb(ctx)
  const [payer] = await db
    .select({ name: users.name, telegramUsername: users.telegramUsername })
    .from(users)
    .where(eq(users.id, payment.userId))
    .limit(1)
  const managers = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, payment.organizationId),
        eq(organizationMembers.status, 'active'),
        inArray(organizationMembers.role, ['owner', 'organizer']),
      ),
    )
  const playerName =
    payer?.name || (payer?.telegramUsername ? `@${payer.telegramUsername}` : 'Игрок')
  for (const m of managers) {
    if (m.userId === payment.userId) continue
    collectNotification(ctx, {
      userId: m.userId,
      type: 'payment_pending_organizer',
      params: {
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        playerName,
        organizationId: payment.organizationId,
        target: 'payments',
        ...extra,
      },
    })
  }
}

export const paymentService = {
  /** Создать pending-платёж для брони (cash/transfer). Вызывается внутри tx из booking. */
  async createForBooking(
    ctx: ServiceContext,
    params: {
      organizationId: number
      userId: number
      bookingId: number
      amount: number
      currency: string
      method: 'cash' | 'transfer'
    },
  ): Promise<Payment> {
    const [p] = await getDb(ctx)
      .insert(payments)
      .values({ ...params, subscriptionId: null, status: 'pending' })
      .returning()
    await notifyOrganizersAboutPending(ctx, p!, await paymentContext(getDb(ctx), p!))
    return p!
  },

  /** Создать pending-платёж за абонемент. */
  async createForSubscription(
    ctx: ServiceContext,
    params: {
      organizationId: number
      userId: number
      subscriptionId: number
      amount: number
      currency: string
      method: 'cash' | 'transfer'
    },
  ): Promise<Payment> {
    const [p] = await getDb(ctx)
      .insert(payments)
      .values({ ...params, bookingId: null, status: 'pending' })
      .returning()
    await notifyOrganizersAboutPending(ctx, p!, await paymentContext(getDb(ctx), p!))
    return p!
  },

  async getById(ctx: ServiceContext, id: number): Promise<Payment> {
    const p = await getDb(ctx).query.payments.findFirst({ where: eq(payments.id, id) })
    if (!p) throw new PaymentNotFoundError(id)
    return p
  },

  /**
   * Ожидающие оплаты с контекстом для организатора (Task 6.8.11): игрок (публичные поля),
   * событие брони или план абонемента.
   */
  async listPending(ctx: ServiceContext, orgId: number) {
    const rows = await getDb(ctx)
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        method: payments.method,
        createdAt: payments.createdAt,
        bookingId: payments.bookingId,
        subscriptionId: payments.subscriptionId,
        userId: users.id,
        userName: users.name,
        telegramUsername: users.telegramUsername,
        image: users.image,
        eventId: events.id,
        eventTitle: events.title,
        eventStartsAt: events.startsAt,
        planName: subscriptionPlans.name,
      })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .leftJoin(bookings, eq(bookings.id, payments.bookingId))
      .leftJoin(events, eq(events.id, bookings.eventId))
      .leftJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
      .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
      .where(and(eq(payments.organizationId, orgId), eq(payments.status, 'pending')))
      .orderBy(asc(payments.createdAt))
    return rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      currency: r.currency,
      method: r.method,
      createdAt: r.createdAt,
      bookingId: r.bookingId,
      subscriptionId: r.subscriptionId,
      user: {
        id: r.userId,
        name: r.userName,
        telegramUsername: r.telegramUsername,
        image: r.image,
      },
      event: r.eventId ? { id: r.eventId, title: r.eventTitle!, startsAt: r.eventStartsAt! } : null,
      plan: r.planName ? { name: r.planName } : null,
    }))
  },

  /**
   * Подтвердить оплату (single source of truth). Атомарно:
   * payment→succeeded + booking→confirmed / subscription→active + ledger income.
   * Если booking уже не pending_payment — payment всё равно succeeded (деньги получены).
   */
  async confirm(
    ctx: ServiceContext,
    paymentId: number,
    opts: { orgId?: number } = {},
  ): Promise<Payment> {
    const db = getDb(ctx)
    return db.transaction(async (tx) => {
      // атомарно: только pending → succeeded; параллельный confirm получит 409 (6.8.1)
      const succeeded = await transitionPayment(
        tx,
        paymentId,
        'pending',
        { status: 'succeeded', confirmedByUserId: ctx.userId, confirmedAt: new Date() },
        opts.orgId ?? ctx.organization?.id,
      )
      const payment = succeeded

      // side effect
      if (payment.bookingId) {
        // бронь подтверждается, только если ссылается именно на этот платёж (6.8.5)
        await tx
          .update(bookings)
          .set({ status: 'confirmed', confirmedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(bookings.id, payment.bookingId),
              eq(bookings.paymentId, payment.id),
              eq(bookings.status, 'pending_payment'),
            ),
          )
      } else if (payment.subscriptionId) {
        // активация со сроком плана, отсчёт от подтверждения (6.8.3)
        const sub = await tx.query.subscriptions.findFirst({
          where: eq(subscriptions.id, payment.subscriptionId),
        })
        if (sub?.status === 'pending') {
          const plan = await tx.query.subscriptionPlans.findFirst({
            where: eq(subscriptionPlans.id, sub.planId),
            columns: { validityDays: true },
          })
          const now = new Date()
          const expiresAt =
            plan?.validityDays != null
              ? new Date(now.getTime() + plan.validityDays * 24 * 3600_000)
              : null
          const [activated] = await tx
            .update(subscriptions)
            .set({ status: 'active', activatedAt: now, expiresAt, updatedAt: now })
            .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.status, 'pending')))
            .returning()
          if (activated) {
            await auditService.record(
              { ...ctx, db: tx },
              {
                organizationId: payment.organizationId,
                action: AUDIT_ACTIONS.SUBSCRIPTION_ACTIVATED,
                entityType: 'subscription',
                entityId: sub.id,
                newValue: { expiresAt, paymentId: payment.id },
              },
            )
          }
        }
      }

      // ledger income
      await ledgerService.createEntry(
        { userId: ctx.userId, db: tx },
        {
          organizationId: payment.organizationId,
          type: 'income',
          category: 'payment_income',
          amount: payment.amount,
          currency: payment.currency,
          paymentId: payment.id,
          description: payment.bookingId ? 'Оплата участия' : 'Оплата абонемента',
        },
      )

      collectNotification(ctx, {
        userId: payment.userId,
        type: 'payment_confirmed',
        params: {
          amount: payment.amount,
          currency: payment.currency,
          organizationId: payment.organizationId,
          target: payment.subscriptionId ? 'subscriptions' : 'event',
          ...(await paymentContext(tx, payment)),
        },
      })

      return succeeded!
    })
  },

  /** Отклонить pending-платёж. Booking отменяется (слот освобождается). */
  async cancel(
    ctx: ServiceContext,
    paymentId: number,
    opts: { orgId?: number } = {},
  ): Promise<Payment> {
    const db = getDb(ctx)
    return db.transaction(async (tx) => {
      const cancelled = await transitionPayment(
        tx,
        paymentId,
        'pending',
        { status: 'cancelled' },
        opts.orgId ?? ctx.organization?.id,
      )
      const payment = cancelled

      if (payment.bookingId) {
        const booking = await tx.query.bookings.findFirst({
          where: eq(bookings.id, payment.bookingId),
        })
        // старый платёж не трогает новую бронь (6.8.5)
        if (booking && booking.paymentId === payment.id && booking.status === 'pending_payment') {
          // освобождение места через общую отмену → промоушен листа ожидания (6.8.4).
          // Ленивый импорт: bookings/service импортирует payments/service.
          const { bookingService } = await import('../bookings/service')
          const txCtx = { ...ctx, db: tx }
          const event = await tx.query.events.findFirst({
            where: eq(events.id, booking.eventId),
            columns: { startsAt: true },
          })
          if (event && event.startsAt > new Date()) {
            await bookingService.cancel(txCtx, booking.id, { byAdmin: true })
          } else {
            await tx
              .update(bookings)
              .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
              .where(eq(bookings.id, booking.id))
          }
        }
      }
      if (payment.subscriptionId) {
        // отменяем только неоплаченный абонемент (6.8.3)
        await tx
          .update(subscriptions)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(
            and(eq(subscriptions.id, payment.subscriptionId), eq(subscriptions.status, 'pending')),
          )
      }
      collectNotification(ctx, {
        userId: payment.userId,
        type: 'payment_rejected',
        params: {
          amount: payment.amount,
          currency: payment.currency,
          organizationId: payment.organizationId,
          target: payment.subscriptionId ? 'subscriptions' : 'event',
          ...(await paymentContext(tx, payment)),
        },
      })
      return cancelled!
    })
  },

  /** Вернуть succeeded-платёж: refunded + ledger expense (append-only). */
  async refund(ctx: ServiceContext, paymentId: number, reason?: string): Promise<Payment> {
    const db = getDb(ctx)
    return db.transaction(async (tx) => {
      const refunded = await transitionPayment(tx, paymentId, 'succeeded', {
        status: 'refunded',
        refundedAt: new Date(),
      })
      const payment = refunded

      await ledgerService.createEntry(
        { userId: ctx.userId, db: tx },
        {
          organizationId: payment.organizationId,
          type: 'expense',
          category: 'refund',
          amount: payment.amount,
          currency: payment.currency,
          paymentId: payment.id,
          description: reason ?? 'Возврат оплаты',
        },
      )
      return refunded!
    })
  },
}
