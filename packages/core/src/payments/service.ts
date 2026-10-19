import {
  and,
  asc,
  bookings,
  desc,
  eq,
  events,
  inArray,
  isNull,
  ne,
  organizationMembers,
  payments,
  sql,
  subscriptionPlans,
  subscriptions,
  users,
  type Booking,
  type Payment,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'

import { ledgerService } from '../ledger/service'
import { collectNotification } from '../notifier/collect'
import { getDb, type ServiceContext } from '../shared/context'

import { PaymentNotFoundError, PaymentNotPendingError, PaymentNotSucceededError } from './errors'
import { listPaymentHistory } from './history'

type Db = ReturnType<typeof getDb>
type BookingRef = Pick<Booking, 'id' | 'incarnation'>

/**
 * Условный переход статуса платежа (Task 6.8.1): `WHERE status = from [AND organization_id]`.
 * 0 строк → точная ошибка. Возвращает платёж ДО перехода и после.
 */
async function transitionPayment(
  db: Db,
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

/** Booking money operations share the event-first lock order with settlement and cancellation. */
async function lockPaymentEvent(db: Db, paymentId: number): Promise<void> {
  const [bookingEvent] = await db
    .select({ eventId: bookings.eventId })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(eq(payments.id, paymentId))
    .limit(1)
  if (bookingEvent) await db.execute(sql`SELECT pg_advisory_xact_lock(${bookingEvent.eventId})`)
}

/**
 * Живые платежи записи (ADR v3, «Денежная модель нескольких мест»): текущее воплощение, место не
 * освобождено, `pending`/`succeeded`. Инвариант: для платной fixed-записи вне очереди их число = seats.
 */
function liveOf(booking: BookingRef) {
  return and(
    eq(payments.bookingId, booking.id),
    eq(payments.bookingIncarnation, booking.incarnation),
    isNull(payments.seatReleasedAt),
    inArray(payments.status, ['pending', 'succeeded']),
  )
}

/** Платёж — живой платёж записи (а не прошлого воплощения или освобождённого места). */
function isLive(payment: Payment, booking: BookingRef | undefined): booking is Booking {
  return (
    !!booking &&
    payment.bookingId === booking.id &&
    payment.bookingIncarnation === booking.incarnation &&
    payment.seatReleasedAt === null
  )
}

/** Контекст платежа для уведомлений (8.8.5): событие или план абонемента. */
async function paymentContext(
  db: Db,
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
 * Уведомить управляющих организации о новом pending-платеже (Task 8.8.6). Для записи на несколько
 * мест — одно уведомление на операцию с суммой и числом мест (20.1.2).
 * Собирается в транзакции, отправляется после коммита.
 */
async function notifyOrganizersAboutPending(
  ctx: ServiceContext,
  payment: Payment,
  extra: {
    eventTitle?: string
    eventDate?: string
    eventId?: number
    planName?: string
  } = {},
  total: { amount: number; seats: number } = { amount: payment.amount, seats: 1 },
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
      // заявка на оплату: одно уведомление организатору на платёж-основание операции
      dedupKey: `payment_pending_organizer:payment:${payment.id}:user:${m.userId}`,
      params: {
        amount: total.amount,
        seats: total.seats,
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

const sum = (rows: Payment[]) => rows.reduce((a, p) => a + p.amount, 0)

/**
 * Ключ дедупликации ленты для подтверждения или отклонения (ADR v3, «Лента уведомлений»): одно
 * уведомление на операцию над записью — запись, её воплощение и наименьший `payment_id` операции
 * (повтор операции даёт тот же ключ, следующая операция над той же записью — новый). Платёж
 * абонемента — по своему `payment_id`.
 */
function paymentOperationKey(
  type: 'payment_confirmed' | 'payment_rejected',
  rows: Payment[],
  userId: number,
): string {
  const first = rows.reduce((a, p) => (p.id < a.id ? p : a))
  const subject = first.bookingId
    ? `booking:${first.bookingId}:${first.bookingIncarnation}:${first.id}`
    : `payment:${first.id}`
  return `${type}:${subject}:user:${userId}`
}

export const paymentService = {
  listHistory: listPaymentHistory,
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
    options: { notifyOrganizers?: boolean } = {},
  ): Promise<Payment> {
    // booking_incarnation подставляет триггер БД (текущее воплощение записи, 20.1.2)
    const [p] = await getDb(ctx)
      .insert(payments)
      .values({ ...params, subscriptionId: null, status: 'pending' })
      .returning()
    if (options.notifyOrganizers !== false)
      await notifyOrganizersAboutPending(ctx, p!, await paymentContext(getDb(ctx), p!))
    return p!
  },

  /**
   * Fixed по местам (20.1.2, ADR): `count` pending-платежей записи на `amount` каждый — один платёж
   * на место; сумма K × цена точна без деления. Организаторы получают одно уведомление на операцию.
   * Вызывается под advisory-lock события.
   */
  async createSeatPayments(
    ctx: ServiceContext,
    booking: Pick<Booking, 'id' | 'incarnation' | 'organizationId' | 'userId'>,
    params: { count: number; amount: number; currency: string; method: 'cash' | 'transfer' },
  ): Promise<Payment[]> {
    if (!Number.isInteger(params.count) || params.count < 1)
      throw new RangeError('count must be >= 1')
    const db = getDb(ctx)
    const rows = await db
      .insert(payments)
      .values(
        Array.from({ length: params.count }, () => ({
          organizationId: booking.organizationId,
          userId: booking.userId,
          bookingId: booking.id,
          bookingIncarnation: booking.incarnation,
          subscriptionId: null,
          amount: params.amount,
          currency: params.currency,
          method: params.method,
          status: 'pending' as const,
        })),
      )
      .returning()
    const created = rows.sort((a, b) => a.id - b.id)
    await notifyOrganizersAboutPending(ctx, created[0]!, await paymentContext(db, created[0]!), {
      amount: sum(created),
      seats: created.length,
    })
    return created
  },

  /** Живые платежи записи в порядке создания (`created_at, id`). */
  async listLive(ctx: ServiceContext, booking: BookingRef): Promise<Payment[]> {
    return getDb(ctx)
      .select()
      .from(payments)
      .where(liveOf(booking))
      .orderBy(asc(payments.createdAt), asc(payments.id))
  },

  /**
   * Снять `count` мест с денег записи (частичная отмена, 20.1.2, D-14): сначала неоплаченные места —
   * самые поздние `pending` → `cancelled`; если их не хватает — самые поздние `succeeded` освобождаются
   * (`seat_released_at`), платёж остаётся `succeeded`, касса не меняется. Под advisory-lock события.
   */
  async releaseSeats(
    ctx: ServiceContext,
    booking: BookingRef,
    count: number,
  ): Promise<{ cancelled: number; released: number }> {
    const db = getDb(ctx)
    const live = await db
      .select()
      .from(payments)
      .where(liveOf(booking))
      .orderBy(desc(payments.createdAt), desc(payments.id))
    const pending = live.filter((p) => p.status === 'pending').slice(0, count)
    const paid = live.filter((p) => p.status === 'succeeded').slice(0, count - pending.length)
    if (pending.length > 0)
      await db
        .update(payments)
        .set({ status: 'cancelled' })
        .where(
          and(
            inArray(
              payments.id,
              pending.map((p) => p.id),
            ),
            eq(payments.status, 'pending'),
          ),
        )
    if (paid.length > 0)
      await db
        .update(payments)
        .set({ seatReleasedAt: new Date() })
        .where(
          and(
            inArray(
              payments.id,
              paid.map((p) => p.id),
            ),
            eq(payments.status, 'succeeded'),
          ),
        )
    return { cancelled: pending.length, released: paid.length }
  },

  /**
   * Отмена записи (bookingService.cancel, D-14): все `pending`-живые платежи → `cancelled`, все
   * `succeeded`-живые освобождаются без возврата. Возвращает, сколько оплаченных мест освобождено.
   */
  async releaseAll(ctx: ServiceContext, booking: BookingRef): Promise<{ released: number }> {
    const db = getDb(ctx)
    await db
      .update(payments)
      .set({ status: 'cancelled' })
      .where(and(liveOf(booking), eq(payments.status, 'pending')))
    const released = await db
      .update(payments)
      .set({ seatReleasedAt: new Date() })
      .where(and(liveOf(booking), eq(payments.status, 'succeeded')))
      .returning({ id: payments.id })
    return { released: released.length }
  },

  /**
   * Статус записи — производная от платежей мест (ADR): платная запись в основе `confirmed` тогда и
   * только тогда, когда все её живые платежи `succeeded`; `bookings.payment_id` — первый живой платёж
   * (для читателей R0.7). Записи без живых платежей (абонемент, бесплатно, split до фиксации) не меняются.
   */
  async syncBookingPayments(ctx: ServiceContext, bookingId: number): Promise<Booking | null> {
    const db = getDb(ctx)
    const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
    if (!booking || !['pending_payment', 'confirmed'].includes(booking.status)) return null
    const live = await this.listLive(ctx, booking)
    if (live.length === 0) {
      // запись на абонементе без наличных мест: все места оплачены занятиями
      if (booking.method !== 'subscription' || booking.status === 'confirmed') return booking
      const [synced] = await db
        .update(bookings)
        .set({
          status: 'confirmed',
          paymentId: null,
          confirmedAt: booking.confirmedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, booking.id))
        .returning()
      return synced!
    }
    const status = live.some((p) => p.status === 'pending') ? 'pending_payment' : 'confirmed'
    if (status === booking.status && booking.paymentId === live[0]!.id) return booking
    const [synced] = await db
      .update(bookings)
      .set({
        status,
        paymentId: live[0]!.id,
        // добавление неоплаченных мест не стирает момент подтверждения записи (ревью 20.1.2)
        confirmedAt:
          status === 'confirmed' ? (booking.confirmedAt ?? new Date()) : booking.confirmedAt,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id))
      .returning()
    return synced!
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
   * событие брони или план абонемента. Платежи мест одной записи — одна строка (20.1.2): `id` —
   * первый платёж (подтверждение и отклонение по нему действуют на всю запись), `amount` — сумма,
   * `seats` — число неоплаченных мест, `paymentIds` — все платежи строки.
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
        bookingIncarnation: payments.bookingIncarnation,
        currentIncarnation: bookings.incarnation,
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
      .orderBy(asc(payments.createdAt), asc(payments.id))
    const groups = new Map<
      string,
      { first: (typeof rows)[number]; amount: number; paymentIds: number[] }
    >()
    for (const r of rows) {
      const key =
        r.bookingId !== null && r.bookingIncarnation === r.currentIncarnation
          ? `booking:${r.bookingId}`
          : `payment:${r.id}`
      const group = groups.get(key)
      if (group) {
        group.amount += r.amount
        group.paymentIds.push(r.id)
      } else groups.set(key, { first: r, amount: r.amount, paymentIds: [r.id] })
    }
    return [...groups.values()].map(({ first: r, amount, paymentIds }) => ({
      id: r.id,
      amount,
      seats: paymentIds.length,
      paymentIds,
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
   * Подтвердить оплату (single source of truth). Для платежа записи — операция над записью (20.1.2):
   * все `pending`-живые платежи её мест → `succeeded` (каждый условно, доход кассы — по платежу),
   * затем статус записи пересчитывается (`confirmed`, когда все живые оплачены); одно уведомление.
   * Платёж прошлого воплощения записи новую бронь не трогает (6.8.5). Абонемент → active.
   */
  async confirm(
    ctx: ServiceContext,
    paymentId: number,
    opts: { orgId?: number } = {},
  ): Promise<Payment> {
    const db = getDb(ctx)
    return db.transaction(async (tx) => {
      // атомарно: только pending → succeeded; параллельный confirm получит 409 (6.8.1)
      await lockPaymentEvent(tx, paymentId)
      const confirmedSet = { status: 'succeeded' as const, confirmedByUserId: ctx.userId }
      const succeeded = await transitionPayment(
        tx,
        paymentId,
        'pending',
        { ...confirmedSet, confirmedAt: new Date() },
        opts.orgId ?? ctx.organization?.id,
      )
      const payment = succeeded
      const confirmed: Payment[] = [payment]

      // side effect
      if (payment.bookingId) {
        const booking = await tx.query.bookings.findFirst({
          where: eq(bookings.id, payment.bookingId),
        })
        if (isLive(payment, booking)) {
          const others = await tx
            .update(payments)
            .set({ ...confirmedSet, confirmedAt: new Date() })
            .where(
              and(liveOf(booking), eq(payments.status, 'pending'), ne(payments.id, payment.id)),
            )
            .returning()
          confirmed.push(...others.sort((a, b) => a.id - b.id))
          await this.syncBookingPayments({ ...ctx, db: tx }, booking.id)
        }
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

      // ledger income — по каждому платежу (ledger_income_payment_uniq)
      for (const p of confirmed)
        await ledgerService.createEntry(
          { userId: ctx.userId, db: tx },
          {
            organizationId: p.organizationId,
            type: 'income',
            category: 'payment_income',
            amount: p.amount,
            currency: p.currency,
            paymentId: p.id,
            description: p.bookingId ? 'Оплата участия' : 'Оплата абонемента',
          },
        )

      collectNotification(ctx, {
        userId: payment.userId,
        type: 'payment_confirmed',
        dedupKey: paymentOperationKey('payment_confirmed', confirmed, payment.userId),
        params: {
          amount: sum(confirmed),
          seats: confirmed.length,
          currency: payment.currency,
          organizationId: payment.organizationId,
          target: payment.subscriptionId ? 'subscriptions' : 'event',
          ...(await paymentContext(tx, payment)),
        },
      })

      return succeeded!
    })
  },

  /**
   * Отклонить pending-платёж. Для платежа записи — операция над записью (20.1.2): все `pending`-живые
   * платежи её мест → `cancelled`. Есть оплаченные места — снимаются только неоплаченные (seats
   * уменьшается, запись `confirmed`, освободившиеся места уходят очереди); оплаченных нет — запись
   * отменяется целиком (6.8.4, с продвижением очереди). Платёж прошлого воплощения запись не трогает.
   */
  async cancel(
    ctx: ServiceContext,
    paymentId: number,
    opts: { orgId?: number } = {},
  ): Promise<Payment> {
    const db = getDb(ctx)
    return db.transaction(async (tx) => {
      const organizationId = opts.orgId ?? ctx.organization?.id
      const paymentConditions = [eq(payments.id, paymentId)]
      if (organizationId !== undefined) {
        paymentConditions.push(eq(payments.organizationId, organizationId))
      }
      const [bookingEvent] = await tx
        .select({ eventId: bookings.eventId })
        .from(payments)
        .innerJoin(bookings, eq(bookings.id, payments.bookingId))
        .where(and(...paymentConditions))
        .limit(1)
      // Та же последовательность, что у eventService.cancel: сначала событие, потом платёж.
      if (bookingEvent) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${bookingEvent.eventId})`)
      }
      const cancelled = await transitionPayment(
        tx,
        paymentId,
        'pending',
        { status: 'cancelled' },
        organizationId,
      )
      const payment = cancelled
      const rejected: Payment[] = [payment]
      let keptSeats = 0

      if (payment.bookingId) {
        const booking = await tx.query.bookings.findFirst({
          where: eq(bookings.id, payment.bookingId),
        })
        // старый платёж не трогает новую бронь (6.8.5)
        if (isLive(payment, booking) && ['pending_payment', 'confirmed'].includes(booking.status)) {
          const txCtx = { ...ctx, db: tx }
          // места записи на абонементе, оплаченные занятиями: места сверх живых платежей (до отклонения
          // их было на один больше — отклоняемый платёж уже cancelled). Они оплачены и остаются.
          const liveBefore = (await this.listLive(txCtx, booking)).length + 1
          const subscriptionSeats =
            booking.method === 'subscription' && booking.subscriptionId
              ? Math.max(0, booking.seats - liveBefore)
              : 0
          const others = await tx
            .update(payments)
            .set({ status: 'cancelled' })
            .where(and(liveOf(booking), eq(payments.status, 'pending')))
            .returning()
          rejected.push(...others)
          const paid = await this.listLive(txCtx, booking)
          const event = await tx.query.events.findFirst({
            where: eq(events.id, booking.eventId),
            columns: { startsAt: true },
          })
          // Ленивый импорт: bookings/service импортирует payments/service.
          const { bookingService } = await import('../bookings/service')
          const kept = paid.length + subscriptionSeats
          if (kept > 0) {
            // оплаченные места (платежи и занятия абонемента) остаются: снимаются только отклонённые
            keptSeats = kept
            await tx
              .update(bookings)
              .set({ seats: kept, updatedAt: new Date() })
              .where(eq(bookings.id, booking.id))
            await this.syncBookingPayments(txCtx, booking.id)
            await auditService.record(txCtx, {
              organizationId: booking.organizationId,
              action: AUDIT_ACTIONS.BOOKING_SEATS_CHANGED,
              entityType: 'booking',
              entityId: booking.id,
              oldValue: { seats: booking.seats },
              newValue: { seats: kept, reason: 'payment_rejected' },
            })
            if (event && event.startsAt > new Date())
              await bookingService.promoteFromWaitlist(txCtx, booking.eventId)
          } else if (event && event.startsAt > new Date()) {
            // освобождение места через общую отмену → промоушен листа ожидания (6.8.4).
            // число мест на абонементе посчитано до отмены платежей (здесь 0: kept === 0)
            await bookingService.cancel(txCtx, booking.id, {
              byAdmin: true,
              subscriptionSeats,
            })
          } else {
            await tx
              .update(bookings)
              .set({
                status: 'cancelled',
                waitlistSeats: 0,
                cancelledAt: new Date(),
                updatedAt: new Date(),
              })
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
        dedupKey: paymentOperationKey('payment_rejected', rejected, payment.userId),
        params: {
          amount: sum(rejected),
          seats: rejected.length,
          keptSeats,
          currency: payment.currency,
          organizationId: payment.organizationId,
          target: payment.subscriptionId ? 'subscriptions' : 'event',
          ...(await paymentContext(tx, payment)),
        },
      })
      return cancelled!
    })
  },

  /**
   * Вернуть succeeded-платёж: refunded + ledger expense (append-only). Доступно и для освобождённого
   * места (D-14): `seat_released_at` при возврате не меняется.
   */
  async refund(ctx: ServiceContext, paymentId: number, reason?: string): Promise<Payment> {
    const db = getDb(ctx)
    return db.transaction(async (tx) => {
      await lockPaymentEvent(tx, paymentId)
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
