import {
  and,
  asc,
  bookings,
  desc,
  gte,
  lt,
  eq,
  events,
  inArray,
  organizationMembers,
  payments,
  sql,
  users,
  type Booking,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { EventNotFoundError } from '../events/errors'
import { collectNotification } from '../notifier/collect'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'
import { NoActiveSubscriptionError } from '../subscriptions/errors'
import { subscriptionService } from '../subscriptions/service'

import {
  AlreadyBookedError,
  AttendanceTooEarlyError,
  BookingMethodNotAllowedError,
  BookingNotCancellableError,
  BookingDeadlinePassedError,
  BookingNotFoundError,
  CannotCancelOthersError,
  EventNotBookableError,
} from './errors'
import { AttendanceInput, BookInput, PageInput, type BookInput as Input } from './schemas'

export interface EventBookingRow {
  id: number
  eventId: number
  status: Booking['status']
  method: Booking['method']
  bookedAt: Date
  confirmedAt: Date | null
  subscriptionId: number | null
  paymentId: number | null
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
}

/** Методы записи на платное событие; online — Phase 12. */
const PAID_METHODS: string[] = ['subscription', 'cash', 'transfer']

export const bookingService = {
  /**
   * Записать пользователя (ctx.userId) на событие.
   * Есть место → confirmed (free) / pending_payment (cash/transfer) / confirmed (subscription).
   * Нет места → waitlisted (consume при promotion, не сейчас).
   * unique(event,user) + транзакция защищают от гонок (финал в 5.3.5).
   */
  async book(ctx: ServiceContext, orgId: number, eventId: number, input: Input): Promise<Booking> {
    const parsed = BookInput.parse(input)
    const db = getDb(ctx)

    return db.transaction(async (tx) => {
      // 1. событие
      const event = await tx.query.events.findFirst({ where: eq(events.id, eventId) })
      if (!event || event.organizationId !== orgId) throw new EventNotBookableError('not found')
      if (event.status === 'cancelled') throw new EventNotBookableError('cancelled')
      if (event.status !== 'published') throw new EventNotBookableError('not open')
      if (event.startsAt < new Date()) throw new EventNotBookableError('already started')
      // метод должен соответствовать цене (Task 5.13.9): платное — только абонемент/наличные/перевод
      if (event.price > 0 && !PAID_METHODS.includes(parsed.method)) {
        throw new BookingMethodNotAllowedError(parsed.method)
      }

      // 2. активное членство
      const member = await tx.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, ctx.userId),
        ),
      })
      // pending — заявка, не участник (5.13.11)
      if (!member || member.status !== 'active') {
        throw new EventNotBookableError(
          member?.status === 'pending' ? 'membership pending approval' : 'not a member',
        )
      }

      if (parsed.method === 'subscription') {
        await organizationService.requireSubscriptionsEnabled({ ...ctx, db: tx }, orgId)
      }

      // 3. существующая бронь (reactivation если cancelled)
      const existing = await tx.query.bookings.findFirst({
        where: and(eq(bookings.eventId, eventId), eq(bookings.userId, ctx.userId)),
      })
      if (existing && existing.status !== 'cancelled') throw new AlreadyBookedError()

      // CONCURRENCY GUARD: сериализуем allocation для этого события.
      // pg_advisory_xact_lock освобождается автоматически в конце транзакции.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)

      // 4. место? (confirmed + pending_payment занимают слот)
      const [countRow] = await tx
        .select({ taken: sql<number>`count(*)::int` })
        .from(bookings)
        .where(
          and(
            eq(bookings.eventId, eventId),
            sql`${bookings.status} IN ('confirmed', 'pending_payment')`,
          ),
        )
      const taken = countRow?.taken ?? 0
      const hasSpot = taken < event.capacity

      // 5. метод/статус
      let status: 'confirmed' | 'waitlisted' | 'pending_payment'
      let method = parsed.method
      let confirmedAt: Date | null = null
      let subscriptionId: number | null = null

      if (!hasSpot) {
        status = 'waitlisted'
        if (event.price === 0) method = 'free'
        // выбранный абонемент запоминаем, сессия списывается при промоушене (5.13.6)
        else if (parsed.method === 'subscription') subscriptionId = parsed.subscriptionId ?? null
      } else if (event.price === 0) {
        status = 'confirmed'
        method = 'free'
        confirmedAt = new Date()
      } else if (parsed.method === 'subscription') {
        // списываем сессию абонемента (atomic, FIFO или конкретный)
        const consumed = await subscriptionService.consumeSession(
          { userId: ctx.userId, db: tx },
          orgId,
          parsed.subscriptionId,
        )
        subscriptionId = consumed.id
        status = 'confirmed'
        confirmedAt = new Date()
      } else {
        // cash/transfer/online — слот занят, ждёт подтверждения оплаты (Phase 6)
        status = 'pending_payment'
      }

      // 6. запись (reactivation обновляет cancelled-строку, иначе insert)
      let result: Booking
      if (existing) {
        const [reactivated] = await tx
          .update(bookings)
          .set({
            status,
            method,
            confirmedAt,
            // связи от прошлой брони сбрасываются (Task 5.13.8): новый абонемент/платёж ниже
            subscriptionId,
            paymentId: null,
            cancelledAt: null,
            bookedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, existing.id))
          .returning()
        result = reactivated!
      } else {
        const [created] = await tx
          .insert(bookings)
          .values({
            eventId,
            userId: ctx.userId,
            organizationId: orgId,
            status,
            method,
            subscriptionId,
            confirmedAt,
          })
          .returning()
        result = created!
      }

      // 7. платёж для pending_payment (cash/transfer) — Phase 6
      if (status === 'pending_payment' && (method === 'cash' || method === 'transfer')) {
        const payment = await paymentService.createForBooking(
          // notifications прокидываем: организаторы получают уведомление о новом платеже (8.8.6)
          { ...ctx, db: tx },
          {
            organizationId: orgId,
            userId: ctx.userId,
            bookingId: result.id,
            amount: event.price,
            currency: event.currency,
            method,
          },
        )
        const [linked] = await tx
          .update(bookings)
          .set({ paymentId: payment.id })
          .where(eq(bookings.id, result.id))
          .returning()
        result = linked!
      }
      await auditService.record(
        { ...ctx, db: tx },
        {
          organizationId: orgId,
          action: AUDIT_ACTIONS.BOOKING_CREATED,
          entityType: 'booking',
          entityId: result.id,
          newValue: { eventId, status: result.status, method: result.method },
        },
      )
      // собрать уведомление (отправится после коммита)
      collectNotification(ctx, {
        userId: ctx.userId,
        type:
          result.status === 'waitlisted'
            ? 'booking_waitlisted'
            : result.status === 'pending_payment'
              ? 'booking_pending_payment' // место держится до подтверждения оплаты (8.9.1)
              : 'booking_confirmed',
        params: {
          eventTitle: event.title,
          eventDate: event.startsAt.toISOString(),
          organizationId: orgId,
          eventId,
          amount: event.price,
          currency: event.currency,
          method: result.method,
        },
      })

      return result
    })
  },

  /**
   * Состав события для организатора: только публичные поля пользователя (Task 5.13.2 —
   * `with: { user: true }` тянул bigint telegram_user_id и приватные поля).
   * Порядок: в составе/ждут оплаты → лист ожидания → прочие; внутри — по bookedAt.
   */
  async listByEvent(
    ctx: ServiceContext,
    orgId: number,
    eventId: number,
  ): Promise<EventBookingRow[]> {
    // событие должно принадлежать организации (Task 5.13.3)
    const event = await getDb(ctx).query.events.findFirst({
      where: and(eq(events.id, eventId), eq(events.organizationId, orgId)),
      columns: { id: true },
    })
    if (!event) throw new EventNotFoundError(eventId)
    const rows = await getDb(ctx)
      .select({
        id: bookings.id,
        eventId: bookings.eventId,
        status: bookings.status,
        method: bookings.method,
        bookedAt: bookings.bookedAt,
        confirmedAt: bookings.confirmedAt,
        subscriptionId: bookings.subscriptionId,
        paymentId: bookings.paymentId,
        userId: users.id,
        name: users.name,
        telegramUsername: users.telegramUsername,
        image: users.image,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(and(eq(bookings.eventId, eventId), eq(bookings.organizationId, orgId)))
      .orderBy(
        sql`CASE ${bookings.status} WHEN 'confirmed' THEN 0 WHEN 'pending_payment' THEN 0 WHEN 'attended' THEN 0 WHEN 'no_show' THEN 0 WHEN 'waitlisted' THEN 1 ELSE 2 END`,
        asc(bookings.bookedAt),
      )
    return rows.map(({ userId, name, telegramUsername, image, ...b }) => ({
      ...b,
      user: { id: userId, name, telegramUsername, image },
    }))
  },

  /** Мои брони в организации, фильтр по времени события. */
  /**
   * Публичный состав события для участников (Task 5.13.18): имена/аватары занявших место,
   * без приватных полей и без листа ожидания поимённо.
   */
  async publicRoster(ctx: ServiceContext, orgId: number, eventId: number) {
    const rows = await getDb(ctx)
      .select({
        userId: users.id,
        name: users.name,
        telegramUsername: users.telegramUsername,
        image: users.image,
        status: bookings.status,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(
        and(
          eq(bookings.eventId, eventId),
          eq(bookings.organizationId, orgId),
          sql`${bookings.status} IN ('confirmed','pending_payment','attended','no_show')`,
        ),
      )
      .orderBy(asc(bookings.bookedAt))
      .limit(100)
    return rows.map((r) => ({
      user: { id: r.userId, name: r.name, telegramUsername: r.telegramUsername, image: r.image },
      paid: r.status !== 'pending_payment',
    }))
  },

  /**
   * Мои записи в организации: фильтр по времени события в SQL, пагинация (Task 5.13.14).
   * upcoming — ближайшие сначала, past — последние сначала.
   */
  async listMyBookings(
    ctx: ServiceContext,
    orgId: number,
    filter: 'upcoming' | 'past' | 'all' = 'upcoming',
    page: { limit?: number; offset?: number } = {},
  ) {
    const { limit, offset } = PageInput.parse(page)
    const db = getDb(ctx)
    const now = new Date()
    const conds = [eq(bookings.organizationId, orgId), eq(bookings.userId, ctx.userId)]
    if (filter === 'upcoming') conds.push(gte(events.startsAt, now))
    if (filter === 'past') conds.push(lt(events.startsAt, now))
    const ids = await db
      .select({ id: bookings.id })
      .from(bookings)
      .innerJoin(events, eq(events.id, bookings.eventId))
      .where(and(...conds))
      .orderBy(filter === 'upcoming' ? asc(events.startsAt) : desc(events.startsAt))
      .limit(limit)
      .offset(offset)
    if (ids.length === 0) return []
    const rows = await db.query.bookings.findMany({
      where: inArray(
        bookings.id,
        ids.map((r) => r.id),
      ),
      with: { event: { with: { venue: true } } },
    })
    const order = new Map(ids.map((r, i) => [r.id, i]))
    return rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!)
  },

  /**
   * Отметить посещаемость пачкой (Task 5.13.4): все брони должны принадлежать событию
   * этой организации; отметка — только после начала события; одна транзакция.
   */
  async bulkAttendance(
    ctx: ServiceContext,
    orgId: number,
    eventId: number,
    input: { bookingId: number; attended: boolean }[],
  ): Promise<number> {
    const marks = AttendanceInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const event = await db.query.events.findFirst({
        where: and(eq(events.id, eventId), eq(events.organizationId, orgId)),
      })
      if (!event) throw new EventNotFoundError(eventId)
      if (event.status === 'cancelled') throw new EventNotBookableError('cancelled')
      if (event.startsAt > new Date()) throw new AttendanceTooEarlyError()

      const ids = [...new Set(marks.map((m) => m.bookingId))]
      const rows = await db
        .select({ id: bookings.id, status: bookings.status })
        .from(bookings)
        .where(
          and(
            inArray(bookings.id, ids),
            eq(bookings.eventId, eventId),
            eq(bookings.organizationId, orgId),
          ),
        )
      if (rows.length !== ids.length) throw new BookingNotFoundError(ids.join(','))
      const notMarkable = rows.find((r) => !['confirmed', 'attended', 'no_show'].includes(r.status))
      if (notMarkable) {
        throw new EventNotBookableError('cannot mark attendance for this booking')
      }

      for (const m of marks) {
        await db
          .update(bookings)
          .set({ status: m.attended ? 'attended' : 'no_show', updatedAt: new Date() })
          .where(eq(bookings.id, m.bookingId))
      }
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.BOOKING_ATTENDANCE_MARKED,
        entityType: 'event',
        entityId: eventId,
        newValue: { marks },
      })
      return marks.length
    })
  },

  /**
   * Отменить бронь. Восстанавливает сессию абонемента, продвигает waitlist.
   * self или byAdmin. Deadline действует только для self (admin bypass).
   */
  async cancel(
    ctx: ServiceContext,
    bookingId: number,
    opts: { byAdmin?: boolean } = {},
  ): Promise<{ booking: Booking; promoted: Booking | null }> {
    const db = getDb(ctx)
    return db.transaction(async (tx) => {
      const found = await tx.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        columns: { eventId: true },
      })
      if (!found) throw new BookingNotFoundError(bookingId)
      // сериализуем отмены и записи события (тот же ключ, что в book) — Task 5.13.7
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${found.eventId})`)
      // перечитываем после лока: статус мог измениться параллельной отменой
      const booking = (await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) }))!
      if (booking.status === 'cancelled') return { booking, promoted: null }

      const event = await tx.query.events.findFirst({ where: eq(events.id, booking.eventId) })
      if (!event) throw new BookingNotFoundError(bookingId)

      const isSelf = booking.userId === ctx.userId
      if (!isSelf && !opts.byAdmin) throw new CannotCancelOthersError()

      // посещение отмечено или событие началось — отмена невозможна (Task 5.13.10)
      if (booking.status === 'attended' || booking.status === 'no_show') {
        throw new BookingNotCancellableError('attendance already marked')
      }
      if (event.startsAt <= new Date()) {
        throw new BookingNotCancellableError('event already started')
      }

      if (isSelf && !opts.byAdmin && event.cancellationDeadlineHours != null) {
        const deadline = new Date(
          event.startsAt.getTime() - event.cancellationDeadlineHours * 3600_000,
        )
        if (new Date() > deadline) throw new BookingDeadlinePassedError()
      }

      const freedSlot = booking.status === 'confirmed' || booking.status === 'pending_payment'

      // восстановить сессию абонемента — только если она была списана (у waitlisted
      // subscription_id лишь запоминает выбор, 5.13.6)
      if (booking.subscriptionId && booking.status === 'confirmed') {
        await subscriptionService.restoreSession(
          { userId: booking.userId, db: tx },
          booking.subscriptionId,
        )
      }

      const [cancelled] = await tx
        .update(bookings)
        .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(bookings.id, bookingId))
        .returning()

      // неоплаченный платёж брони отменяется (6.8.6); оплаченный не возвращается автоматически —
      // возврат при отмене игроком — решение организатора
      if (booking.paymentId) {
        await tx
          .update(payments)
          .set({ status: 'cancelled' })
          .where(and(eq(payments.id, booking.paymentId), eq(payments.status, 'pending')))
      }

      await auditService.record(
        { ...ctx, db: tx },
        {
          organizationId: booking.organizationId,
          action: AUDIT_ACTIONS.BOOKING_CANCELLED,
          entityType: 'booking',
          entityId: booking.id,
          oldValue: { status: booking.status },
          newValue: { status: 'cancelled', byAdmin: !!opts.byAdmin },
        },
      )

      // если освободился слот — продвинуть первого из waitlist
      let promoted: Booking | null = null
      if (freedSlot && event.status === 'published') {
        promoted = await this.promoteFromWaitlist({ ...ctx, db: tx }, event.id)
      }
      return { booking: cancelled!, promoted }
    })
  },

  /**
   * Продвинуть первого из листа ожидания (FIFO по bookedAt) в состав.
   * free → confirmed; платное → pending_payment (оплата подтверждается отдельно).
   * subscription-waitlist: остаётся как есть (consume при подтверждении — упрощение MVP).
   * Возвращает продвинутую бронь или null.
   */
  async promoteFromWaitlist(ctx: ServiceContext, eventId: number): Promise<Booking | null> {
    const db = getDb(ctx)
    // вызывающий держит pg_advisory_xact_lock(eventId); повторный захват в той же tx — no-op
    await db.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
    if (!event) return null

    // есть ли место? (confirmed + pending_payment)
    const [countRow] = await db
      .select({ taken: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.eventId, eventId),
          sql`${bookings.status} IN ('confirmed', 'pending_payment')`,
        ),
      )
    if ((countRow?.taken ?? 0) >= event.capacity) return null

    // первый в waitlist (FIFO); SKIP LOCKED — строку не заберут дважды (Task 5.13.7)
    const [next] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.eventId, eventId), eq(bookings.status, 'waitlisted')))
      .orderBy(asc(bookings.bookedAt), asc(bookings.id))
      .limit(1)
      .for('update', { skipLocked: true })
    if (!next) return null

    // Task 5.13.6: промоушен с абонемента списывает сессию; нет абонемента → оплата наличными
    let newStatus: 'confirmed' | 'pending_payment'
    let promotedMethod = next.method
    let promotedSubscriptionId: number | null = null
    if (event.price === 0) {
      newStatus = 'confirmed'
    } else if (next.method === 'subscription') {
      try {
        const consumed = await subscriptionService.consumeSession(
          { userId: next.userId, db },
          next.organizationId,
          next.subscriptionId ?? undefined,
        )
        promotedSubscriptionId = consumed.id
        newStatus = 'confirmed'
      } catch (e) {
        if (!(e instanceof NoActiveSubscriptionError)) throw e
        // выбранный абонемент закончился/истёк — пробуем любой другой активный
        try {
          const consumed = await subscriptionService.consumeSession(
            { userId: next.userId, db },
            next.organizationId,
          )
          promotedSubscriptionId = consumed.id
          newStatus = 'confirmed'
        } catch (e2) {
          if (!(e2 instanceof NoActiveSubscriptionError)) throw e2
          newStatus = 'pending_payment'
          promotedMethod = 'cash'
        }
      }
    } else {
      newStatus = 'pending_payment'
    }

    const [promoted] = await db
      .update(bookings)
      .set({
        status: newStatus,
        method: promotedMethod,
        subscriptionId: promotedSubscriptionId,
        confirmedAt: newStatus === 'confirmed' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, next.id))
      .returning()
    await auditService.record(ctx, {
      organizationId: next.organizationId,
      action: AUDIT_ACTIONS.BOOKING_PROMOTED,
      entityType: 'booking',
      entityId: next.id,
      oldValue: { status: 'waitlisted' },
      newValue: { status: newStatus, method: promotedMethod },
    })

    // платёж при промоушене в pending_payment (cash/transfer) — Phase 6
    if (
      newStatus === 'pending_payment' &&
      (promotedMethod === 'cash' || promotedMethod === 'transfer')
    ) {
      const payment = await paymentService.createForBooking(
        { ...ctx, userId: next.userId, db: ctx.db },
        {
          organizationId: next.organizationId,
          userId: next.userId,
          bookingId: next.id,
          amount: event.price,
          currency: event.currency,
          method: promotedMethod,
        },
      )
      const [linked] = await db
        .update(bookings)
        .set({ paymentId: payment.id })
        .where(eq(bookings.id, next.id))
        .returning()
      collectNotification(ctx, {
        userId: next.userId,
        type: 'waitlist_promoted',
        params: {
          eventTitle: event.title,
          eventDate: event.startsAt.toISOString(),
          organizationId: next.organizationId,
          eventId: event.id,
          needsPayment: true,
        },
      })
      return linked!
    }
    collectNotification(ctx, {
      userId: next.userId,
      type: 'waitlist_promoted',
      params: {
        eventTitle: event.title,
        eventDate: event.startsAt.toISOString(),
        organizationId: next.organizationId,
        eventId: event.id,
        needsPayment: false,
      },
    })
    return promoted!
  },

  async getById(ctx: ServiceContext, bookingId: number): Promise<Booking> {
    const b = await getDb(ctx).query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
    if (!b) throw new BookingNotFoundError(bookingId)
    return b
  },
}
