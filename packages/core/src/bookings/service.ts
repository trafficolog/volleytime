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
  ne,
  organizationMembers,
  organizations,
  payments,
  sql,
  users,
  type Booking,
  type Event,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { EventNotFoundError } from '../events/errors'
import { consumeEventInvite } from '../invites/event-invites'
import { collectNotification } from '../notifier/collect'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'
import { canManageContent } from '../permissions/policies'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'
import { NoActiveSubscriptionError, NotEnoughSessionsError } from '../subscriptions/errors'
import { subscriptionService } from '../subscriptions/service'

import {
  AlreadyBookedError,
  AttendanceTooEarlyError,
  BookingMethodNotAllowedError,
  BookingNotCancellableError,
  BookingCancellationNotAllowedError,
  BookingDeadlinePassedError,
  BookingNotEnoughSeatsError,
  BookingNotFoundError,
  CannotCancelOthersError,
  EventNotBookableError,
  MultiSeatDisabledError,
  SeatsOverLimitError,
} from './errors'
import { isMultiSeatEnabled } from './multi-seat-capability'
import {
  AttendanceInput,
  BookInput,
  ChangeSeatsInput,
  PageInput,
  type BookInput as Input,
  type ChangeSeatsInput as ChangeSeats,
} from './schemas'
import { inQueueSql, takenSeats } from './seats'

export interface EventBookingRow {
  id: number
  eventId: number
  status: Booking['status']
  method: Booking['method']
  /** Места записи в её статусе (20.1.2): «+N» в составе = seats − 1. */
  seats: number
  /** Ещё места в очереди у записи в основе. */
  waitlistSeats: number
  bookedAt: Date
  confirmedAt: Date | null
  subscriptionId: number | null
  paymentId: number | null
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
}

/** Методы записи на платное событие; online — Phase 12. */
const PAID_METHODS: string[] = ['subscription', 'cash', 'transfer']

const isSessionShortage = (e: unknown) =>
  e instanceof NoActiveSubscriptionError || e instanceof NotEnoughSessionsError

/** Ограничения числа мест под lock события: флаг, лимит группы и вместимость (20.1.2). */
async function assertSeatsAllowed(
  ctx: ServiceContext,
  orgId: number,
  event: Event,
  seats: number,
): Promise<void> {
  if (seats > 1 && !isMultiSeatEnabled(process.env.EVENT_MULTI_SEAT_ENABLED))
    throw new MultiSeatDisabledError()
  const org = await getDb(ctx).query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { maxSeatsPerBooking: true },
  })
  if (!org || seats > org.maxSeatsPerBooking || seats > event.capacity)
    throw new SeatsOverLimitError()
}

/** Самостоятельная отмена (целиком или частично) — политика отмены события (D-02) и срок. */
function assertSelfCancellable(event: Event): void {
  if (!event.cancellationAllowed) throw new BookingCancellationNotAllowedError()
  if (event.cancellationDeadlineHours != null) {
    const deadline = new Date(event.startsAt.getTime() - event.cancellationDeadlineHours * 3600_000)
    if (new Date() > deadline) throw new BookingDeadlinePassedError()
  }
}

/**
 * Места записи, оплаченные занятиями абонемента: у записи на абонементе места сверх живых платежей
 * (места, продвинутые из очереди без занятий, оплачиваются наличными — решение владельца 2026-10-14).
 */
async function subscriptionSeatsOf(ctx: ServiceContext, booking: Booking): Promise<number> {
  if (booking.method !== 'subscription' || !booking.subscriptionId) return 0
  const live = await paymentService.listLive(ctx, booking)
  return Math.max(0, booking.seats - live.length)
}

/**
 * Добавить `count` мест записи, уже стоящей в основе (`confirmed`/`pending_payment`): из её очереди
 * (`fromQueue`) или новым запросом игрока. Деньги — по месту (ADR): fixed cash/transfer — ещё `count`
 * платежей и статус пересчитывается; абонемент — ещё `count` занятий с того же абонемента; бесплатно
 * и split до фиксации — без денег. Под advisory-lock события.
 * `cashFallback` (продвижение из очереди): если занятий абонемента не хватает, места не пропускаются,
 * а оплачиваются наличными — порядок очереди не нарушается (решение владельца 2026-10-14, как 5.13.6).
 */
async function addMainSeats(
  ctx: ServiceContext,
  event: Event,
  booking: Booking,
  count: number,
  fromQueue: number,
  opts: { cashFallback?: boolean } = {},
): Promise<Booking> {
  const db = getDb(ctx)
  let payMethod: 'cash' | 'transfer' | null =
    booking.method === 'cash' || booking.method === 'transfer' ? booking.method : null
  if (event.priceMode === 'fixed' && event.price > 0 && booking.method === 'subscription') {
    try {
      await subscriptionService.consumeSessions(
        { userId: booking.userId, db },
        booking.organizationId,
        count,
        booking.subscriptionId ?? undefined,
      )
    } catch (e) {
      if (!opts.cashFallback || !isSessionShortage(e)) throw e
      payMethod = 'cash'
    }
  }
  const [updated] = await db
    .update(bookings)
    .set({
      seats: booking.seats + count,
      waitlistSeats: booking.waitlistSeats - fromQueue,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id))
    .returning()
  if (event.priceMode === 'fixed' && event.price > 0 && payMethod) {
    await paymentService.createSeatPayments({ ...ctx, userId: booking.userId }, updated!, {
      count,
      amount: event.price,
      currency: event.currency,
      method: payMethod,
    })
    return (await paymentService.syncBookingPayments(ctx, booking.id)) ?? updated!
  }
  return updated!
}

export const bookingService = {
  /**
   * Записать пользователя (ctx.userId) на событие на `seats` мест (20.1.2).
   * Хватает мест → confirmed (free/subscription) / pending_payment (cash/transfer, один платёж на место).
   * Мест нет → waitlisted на все места. Свободных меньше, чем просили → 409 `booking.not_enough_seats`,
   * если игрок явно не согласился на очередь (`allowWaitlist`): тогда часть в основу, часть в очередь.
   * Advisory-lock события + unique(event,user) защищают от гонок (5.3.5, 5.13.7).
   */
  async book(ctx: ServiceContext, orgId: number, eventId: number, input: Input): Promise<Booking> {
    const parsed = BookInput.parse(input)
    const db = getDb(ctx)

    return db.transaction(async (tx) => {
      // Read pricing only after the shared event lock: a mode edit may have just committed.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)
      const txCtx = { ...ctx, db: tx }
      // 1. событие
      const event = await tx.query.events.findFirst({ where: eq(events.id, eventId) })
      // чужое событие неотличимо от несуществующего: 404, а не 422 (IDOR, 19.3.1)
      if (!event || event.organizationId !== orgId) throw new EventNotFoundError(eventId)
      if (event.status === 'cancelled') throw new EventNotBookableError('cancelled')
      if (event.status !== 'published') throw new EventNotBookableError('not open')
      if (event.startsAt < new Date()) throw new EventNotBookableError('already started')
      if (event.pricingSettledAt) throw new EventNotBookableError('pricing already settled')
      if (event.priceMode === 'split' && !['cash', 'transfer'].includes(parsed.method)) {
        throw new BookingMethodNotAllowedError(parsed.method)
      }
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
        await organizationService.requireSubscriptionsEnabled(txCtx, orgId)
      }

      // 3. существующая бронь (reactivation если cancelled)
      const existing = await tx.query.bookings.findFirst({
        where: and(eq(bookings.eventId, eventId), eq(bookings.userId, ctx.userId)),
      })
      if (existing && existing.status !== 'cancelled') throw new AlreadyBookedError()
      if (existing?.allocatedAmount != null) throw new EventNotBookableError('allocation is final')

      // 3a. режим записи (20.1.3): на событие `invite` — только по валидному приглашению; проверка и
      // израсходование однократной ссылки — здесь, под lock события, в транзакции записи.
      // Владелец и организатор записывают себя без приглашения (решение владельца 2026-10-15);
      // book() всегда записывает ctx.userId — записи «за другого» здесь нет
      const inviteId =
        event.joinMode === 'invite' && !canManageContent(member)
          ? await consumeEventInvite(txCtx, event, {
              inviteToken: parsed.inviteToken,
              previous: existing
                ? { bookingId: existing.id, inviteId: existing.inviteId }
                : undefined,
            })
          : null

      // 4. места: лимит группы и вместимость, затем свободные места под lock (SUM(seats))
      await assertSeatsAllowed(txCtx, orgId, event, parsed.seats)
      const free = Math.max(0, event.capacity - (await takenSeats(tx, eventId)))
      const mainSeats = Math.min(free, parsed.seats)
      if (mainSeats > 0 && mainSeats < parsed.seats && !parsed.allowWaitlist) {
        throw new BookingNotEnoughSeatsError(free)
      }
      const queueSeats = parsed.seats - mainSeats

      // 5. метод/статус
      let status: 'confirmed' | 'waitlisted' | 'pending_payment'
      let method = parsed.method
      let confirmedAt: Date | null = null
      let subscriptionId: number | null = null

      if (mainSeats === 0) {
        status = 'waitlisted'
        if (event.priceMode === 'fixed' && event.price === 0) method = 'free'
        // выбранный абонемент запоминаем, сессии списываются при промоушене (5.13.6)
        else if (parsed.method === 'subscription') subscriptionId = parsed.subscriptionId ?? null
      } else if (event.priceMode === 'split') {
        status = 'pending_payment'
      } else if (event.price === 0) {
        status = 'confirmed'
        method = 'free'
        confirmedAt = new Date()
      } else if (parsed.method === 'subscription') {
        // одно занятие на место, все с одного абонемента (atomic, FIFO или конкретный)
        const consumed = await subscriptionService.consumeSessions(
          { userId: ctx.userId, db: tx },
          orgId,
          mainSeats,
          parsed.subscriptionId,
        )
        subscriptionId = consumed.id
        status = 'confirmed'
        confirmedAt = new Date()
      } else {
        // cash/transfer/online — места заняты, ждут подтверждения оплаты (Phase 6)
        status = 'pending_payment'
      }
      const seatColumns =
        status === 'waitlisted'
          ? { seats: queueSeats, waitlistSeats: 0 }
          : { seats: mainSeats, waitlistSeats: queueSeats }

      // 6. запись (reactivation обновляет cancelled-строку, иначе insert; воплощение +1 — триггер БД)
      let result: Booking
      if (existing) {
        const [reactivated] = await tx
          .update(bookings)
          .set({
            status,
            method,
            confirmedAt,
            ...seatColumns,
            // связи от прошлой брони сбрасываются (Task 5.13.8): новый абонемент/платёж ниже
            subscriptionId,
            paymentId: null,
            ...(inviteId !== null ? { inviteId } : {}),
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
            inviteId,
            ...seatColumns,
          })
          .returning()
        result = created!
      }

      // 7. платежи для pending_payment (cash/transfer): один платёж на место (ADR, 20.1.2)
      if (
        event.priceMode === 'fixed' &&
        status === 'pending_payment' &&
        (method === 'cash' || method === 'transfer')
      ) {
        // notifications прокидываем: организаторы получают одно уведомление на запись (8.8.6)
        await paymentService.createSeatPayments(txCtx, result, {
          count: mainSeats,
          amount: event.price,
          currency: event.currency,
          method,
        })
        result = (await paymentService.syncBookingPayments(txCtx, result.id))!
      }
      await auditService.record(txCtx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.BOOKING_CREATED,
        entityType: 'booking',
        entityId: result.id,
        newValue: {
          eventId,
          status: result.status,
          method: result.method,
          seats: result.seats,
          waitlistSeats: result.waitlistSeats,
        },
      })
      // собрать уведомление (отправится после коммита)
      collectNotification(ctx, {
        userId: ctx.userId,
        type:
          result.status === 'waitlisted'
            ? 'booking_waitlisted'
            : event.priceMode === 'split'
              ? 'split_booking_reserved'
              : result.status === 'pending_payment'
                ? 'booking_pending_payment' // место держится до подтверждения оплаты (8.9.1)
                : 'booking_confirmed',
        params: {
          eventTitle: event.title,
          eventDate: event.startsAt.toISOString(),
          organizationId: orgId,
          eventId,
          amount: event.price * (result.status === 'waitlisted' ? 1 : result.seats),
          currency: event.currency,
          method: result.method,
          seats: result.seats,
          waitlistSeats: result.waitlistSeats,
        },
      })

      return result
    })
  },

  /**
   * Изменить число мест своей записи (PATCH …/bookings/{id} {seats}, 20.1.2). Уменьшение — частичная
   * отмена: сначала снимаются места в очереди, затем места основы (деньги — `releaseSeats`, D-14:
   * оплаченные не возвращаются автоматически; абонемент — занятия возвращаются), освободившиеся места
   * уходят первым в очереди. Увеличение — только в основу и только при достаточных свободных местах
   * (без прыжка в очереди), иначе 409 `booking.not_enough_seats`. Advisory-lock события.
   */
  async changeSeats(
    ctx: ServiceContext,
    bookingId: number,
    input: ChangeSeats,
  ): Promise<{ booking: Booking; promoted: Booking | null }> {
    const { seats: target } = ChangeSeatsInput.parse(input)
    const db = getDb(ctx)
    return db.transaction(async (tx) => {
      const txCtx = { ...ctx, db: tx }
      const found = await tx.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        columns: { eventId: true },
      })
      if (!found) throw new BookingNotFoundError(bookingId)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${found.eventId})`)
      // перечитываем после лока: места могли измениться параллельной операцией
      const booking = (await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) }))!
      // места меняет только сам игрок (permissions-v3: self); организатор отменяет запись целиком
      if (booking.userId !== ctx.userId) throw new CannotCancelOthersError()
      if (!['confirmed', 'pending_payment', 'waitlisted'].includes(booking.status))
        throw new BookingNotCancellableError(`booking is ${booking.status}`)
      const event = (await tx.query.events.findFirst({ where: eq(events.id, booking.eventId) }))!
      if (booking.allocatedAmount != null || event.pricingSettledAt)
        throw new BookingNotCancellableError('split allocation is final')
      if (event.status === 'cancelled' || event.startsAt <= new Date())
        throw new BookingNotCancellableError('event already started')

      const total = booking.seats + booking.waitlistSeats
      if (target === total) return { booking, promoted: null }

      let updated: Booking
      let promoted: Booking | null = null
      if (target > total) {
        if (event.status !== 'published') throw new EventNotBookableError('not open')
        await assertSeatsAllowed(txCtx, booking.organizationId, event, target)
        const add = target - total
        const free = Math.max(0, event.capacity - (await takenSeats(tx, event.id)))
        // добавленные места не встают в очередь впереди тех, кто записался раньше
        if (booking.status === 'waitlisted' || booking.waitlistSeats > 0 || free < add)
          throw new BookingNotEnoughSeatsError(booking.status === 'waitlisted' ? 0 : free)
        updated = await addMainSeats(txCtx, event, booking, add, 0)
      } else {
        assertSelfCancellable(event)
        const remove = total - target
        const fromQueue =
          booking.status === 'waitlisted' ? 0 : Math.min(remove, booking.waitlistSeats)
        const fromMain = booking.status === 'waitlisted' ? 0 : remove - fromQueue
        if (fromMain > 0) {
          // порядок: неоплаченные места → места абонемента (занятия возвращаются) → оплаченные
          const live = await paymentService.listLive(txCtx, booking)
          const unpaid = Math.min(fromMain, live.filter((p) => p.status === 'pending').length)
          const restore = Math.min(fromMain - unpaid, await subscriptionSeatsOf(txCtx, booking))
          if (restore > 0) {
            await subscriptionService.restoreSessions(
              { userId: booking.userId, db: tx },
              booking.subscriptionId!,
              restore,
            )
          }
          if (fromMain - restore > 0)
            await paymentService.releaseSeats(txCtx, booking, fromMain - restore)
        }
        const [changed] = await tx
          .update(bookings)
          .set({
            seats: booking.status === 'waitlisted' ? target : booking.seats - fromMain,
            waitlistSeats: booking.waitlistSeats - fromQueue,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, booking.id))
          .returning()
        updated = (await paymentService.syncBookingPayments(txCtx, booking.id)) ?? changed!
        if (fromMain > 0 && event.status === 'published')
          promoted = await this.promoteFromWaitlist(txCtx, event.id)
      }
      await auditService.record(txCtx, {
        organizationId: booking.organizationId,
        action: AUDIT_ACTIONS.BOOKING_SEATS_CHANGED,
        entityType: 'booking',
        entityId: booking.id,
        oldValue: { seats: booking.seats, waitlistSeats: booking.waitlistSeats },
        newValue: { seats: updated.seats, waitlistSeats: updated.waitlistSeats },
      })
      return { booking: updated, promoted }
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
        seats: bookings.seats,
        waitlistSeats: bookings.waitlistSeats,
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
   * без приватных полей и без листа ожидания поимённо. `seats` — для «+N» (20.1.2).
   */
  async publicRoster(ctx: ServiceContext, orgId: number, eventId: number) {
    const rows = await getDb(ctx)
      .select({
        userId: users.id,
        name: users.name,
        telegramUsername: users.telegramUsername,
        image: users.image,
        status: bookings.status,
        seats: bookings.seats,
        priceMode: events.priceMode,
        paymentStatus: payments.status,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .innerJoin(events, eq(events.id, bookings.eventId))
      .leftJoin(
        payments,
        and(eq(payments.id, bookings.paymentId), eq(payments.bookingId, bookings.id)),
      )
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
      seats: r.seats,
      paid:
        r.priceMode === 'split' ? r.paymentStatus === 'succeeded' : r.status !== 'pending_payment',
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
    page: { limit?: number; offset?: number; excludeCancelled?: boolean } = {},
  ) {
    const { limit, offset } = PageInput.parse(page)
    const db = getDb(ctx)
    const now = new Date()
    const conds = [eq(bookings.organizationId, orgId), eq(bookings.userId, ctx.userId)]
    if (page.excludeCancelled) conds.push(ne(bookings.status, 'cancelled'))
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
      await db.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)
      const event = await db.query.events.findFirst({
        where: and(eq(events.id, eventId), eq(events.organizationId, orgId)),
      })
      if (!event) throw new EventNotFoundError(eventId)
      if (event.status === 'cancelled') throw new EventNotBookableError('cancelled')
      if (event.priceMode === 'split' && !event.pricingSettledAt)
        throw new EventNotBookableError('pricing not settled')
      if (event.startsAt > new Date()) throw new AttendanceTooEarlyError()

      const ids = [...new Set(marks.map((m) => m.bookingId))]
      const rows = await db
        .select({ id: bookings.id, status: bookings.status, paymentStatus: payments.status })
        .from(bookings)
        .leftJoin(
          payments,
          and(eq(payments.id, bookings.paymentId), eq(payments.bookingId, bookings.id)),
        )
        .where(
          and(
            inArray(bookings.id, ids),
            eq(bookings.eventId, eventId),
            eq(bookings.organizationId, orgId),
          ),
        )
      if (rows.length !== ids.length) throw new BookingNotFoundError(ids.join(','))
      const notMarkable = rows.find(
        (r) =>
          !['confirmed', 'attended', 'no_show'].includes(r.status) ||
          (event.priceMode === 'split' && r.paymentStatus !== 'succeeded'),
      )
      if (notMarkable) {
        throw new EventNotBookableError('cannot mark attendance for this booking')
      }

      for (const m of marks) {
        await db
          .update(bookings)
          // очередная часть мест после начала события уже не продвигается
          .set({
            status: m.attended ? 'attended' : 'no_show',
            waitlistSeats: 0,
            updatedAt: new Date(),
          })
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
   * Отменить бронь целиком. Восстанавливает занятия абонемента (по месту), отменяет неоплаченные
   * платежи мест и освобождает оплаченные без возврата (D-14), продвигает очередь.
   * self или byAdmin. Deadline действует только для self (admin bypass).
   */
  async cancel(
    ctx: ServiceContext,
    bookingId: number,
    opts: { byAdmin?: boolean; subscriptionSeats?: number } = {},
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
      if (isSelf && !opts.byAdmin && booking.allocatedAmount != null) {
        throw new BookingNotCancellableError('split allocation is final')
      }

      // политика группы (снимок D-02): запрет отмены игроком — до проверок посещения (порядок R0.7)
      if (isSelf && !opts.byAdmin && !event.cancellationAllowed) {
        throw new BookingCancellationNotAllowedError()
      }

      // посещение отмечено или событие началось — отмена невозможна (Task 5.13.10)
      if (booking.status === 'attended' || booking.status === 'no_show') {
        throw new BookingNotCancellableError('attendance already marked')
      }
      if (event.startsAt <= new Date()) {
        throw new BookingNotCancellableError('event already started')
      }

      // политика группы (снимок D-02) и срок: только для игрока; организатор отменяет всегда
      if (isSelf && !opts.byAdmin) assertSelfCancellable(event) // срок отмены

      const freedSlot = booking.status === 'confirmed' || booking.status === 'pending_payment'

      // восстановить занятия абонемента — по месту, только если они были списаны (у waitlisted
      // subscription_id лишь запоминает выбор, 5.13.6)
      // Вызывающий, уже отменивший платежи мест (отклонение оплаты), передаёт число мест на
      // абонементе до отмены: после неё «места сверх живых платежей» завысили бы возврат.
      const subscriptionSeats = !['confirmed', 'pending_payment'].includes(booking.status)
        ? 0
        : opts.subscriptionSeats !== undefined
          ? Math.min(opts.subscriptionSeats, booking.seats)
          : await subscriptionSeatsOf({ ...ctx, db: tx }, booking)
      if (subscriptionSeats > 0) {
        await subscriptionService.restoreSessions(
          { userId: booking.userId, db: tx },
          booking.subscriptionId!,
          subscriptionSeats,
        )
      }

      // неоплаченные места отменяются (6.8.6); оплаченные не возвращаются автоматически, а
      // освобождаются (D-14) — возврат при отмене игроком — решение организатора
      await paymentService.releaseAll({ ...ctx, db: tx }, booking)

      const [cancelled] = await tx
        .update(bookings)
        .set({
          status: 'cancelled',
          waitlistSeats: 0,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning()

      await auditService.record(
        { ...ctx, db: tx },
        {
          organizationId: booking.organizationId,
          action: AUDIT_ACTIONS.BOOKING_CANCELLED,
          entityType: 'booking',
          entityId: booking.id,
          oldValue: {
            status: booking.status,
            seats: booking.seats,
            waitlistSeats: booking.waitlistSeats,
          },
          newValue: { status: 'cancelled', byAdmin: !!opts.byAdmin },
        },
      )

      // если освободились места — продвинуть первых из очереди
      let promoted: Booking | null = null
      if (freedSlot && event.status === 'published') {
        promoted = await this.promoteFromWaitlist({ ...ctx, db: tx }, event.id)
      }
      return { booking: cancelled!, promoted }
    })
  },

  /**
   * Отдать свободные места очереди (FIFO по (bookedAt, id), D-03 без планировщика — автопродвижение).
   * Первый в очереди получает столько мест, сколько свободно (остаток остаётся в очереди), затем
   * следующий — пока есть свободные места. free → confirmed; платное → pending_payment (оплата по месту);
   * абонемент списывает занятие на место, без занятий — оплата наличными (5.13.6); запись в очереди
   * никогда не пропускается, порядок очереди не нарушается (решение владельца 2026-10-14).
   * Возвращает первую продвинутую бронь или null.
   */
  async promoteFromWaitlist(ctx: ServiceContext, eventId: number): Promise<Booking | null> {
    return inTransaction(ctx, async (ctx) => {
      const db = getDb(ctx)
      // вызывающий держит pg_advisory_xact_lock(eventId); повторный захват в той же tx — no-op
      await db.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)
      const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
      if (!event || event.status !== 'published' || event.pricingSettledAt) return null

      let first: Booking | null = null
      for (;;) {
        const free = event.capacity - (await takenSeats(db, eventId))
        if (free <= 0) break
        // первый в очереди (FIFO); SKIP LOCKED — строку не заберут дважды (Task 5.13.7)
        const [next] = await db
          .select()
          .from(bookings)
          .where(and(eq(bookings.eventId, eventId), inQueueSql))
          .orderBy(asc(bookings.bookedAt), asc(bookings.id))
          .limit(1)
          .for('update', { skipLocked: true })
        if (!next) break

        let promoted: Booking
        if (next.status === 'waitlisted') {
          promoted = await promoteWaiting(ctx, event, next, Math.min(free, next.seats))
        } else {
          const count = Math.min(free, next.waitlistSeats)
          promoted = await addMainSeats(ctx, event, next, count, count, { cashFallback: true })
          await auditService.record(ctx, {
            organizationId: next.organizationId,
            action: AUDIT_ACTIONS.BOOKING_PROMOTED,
            entityType: 'booking',
            entityId: next.id,
            oldValue: { seats: next.seats, waitlistSeats: next.waitlistSeats },
            newValue: { seats: promoted.seats, waitlistSeats: promoted.waitlistSeats },
          })
          collectNotification(ctx, {
            userId: next.userId,
            type: 'waitlist_promoted',
            params: {
              eventTitle: event.title,
              eventDate: event.startsAt.toISOString(),
              organizationId: next.organizationId,
              eventId: event.id,
              needsPayment: promoted.status === 'pending_payment' && event.priceMode === 'fixed',
              seats: count,
              waitlistSeats: promoted.waitlistSeats,
            },
          })
        }
        first ??= promoted
      }
      return first
    })
  },

  async getById(ctx: ServiceContext, bookingId: number): Promise<Booking> {
    const b = await getDb(ctx).query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
    if (!b) throw new BookingNotFoundError(bookingId)
    return b
  },
}

/**
 * Продвинуть запись, стоящую в очереди целиком, на `count` мест (остаток — в очереди той же записи).
 * Логика R0.7 (5.6.2, 5.13.6) с учётом мест: split → pending_payment; бесплатно → confirmed;
 * абонемент → `count` занятий (выбранный, затем любой, иначе наличные); cash/transfer → платежи мест.
 */
async function promoteWaiting(
  ctx: ServiceContext,
  event: Event,
  next: Booking,
  count: number,
): Promise<Booking> {
  const db = getDb(ctx)
  let newStatus: 'confirmed' | 'pending_payment'
  let promotedMethod = next.method
  let promotedSubscriptionId: number | null = null
  if (event.priceMode === 'split') {
    if (!['cash', 'transfer'].includes(next.method))
      throw new BookingMethodNotAllowedError(next.method)
    newStatus = 'pending_payment'
  } else if (event.price === 0) {
    newStatus = 'confirmed'
  } else if (next.method === 'subscription') {
    const consume = (subscriptionId?: number) =>
      subscriptionService.consumeSessions(
        { userId: next.userId, db },
        next.organizationId,
        count,
        subscriptionId,
      )
    try {
      promotedSubscriptionId = (await consume(next.subscriptionId ?? undefined)).id
      newStatus = 'confirmed'
    } catch (e) {
      if (!isSessionShortage(e)) throw e
      // выбранный абонемент закончился/истёк — пробуем любой другой активный
      try {
        promotedSubscriptionId = (await consume()).id
        newStatus = 'confirmed'
      } catch (e2) {
        if (!isSessionShortage(e2)) throw e2
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
      seats: count,
      waitlistSeats: next.seats - count,
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
    oldValue: { status: 'waitlisted', seats: next.seats },
    newValue: {
      status: newStatus,
      method: promotedMethod,
      seats: count,
      waitlistSeats: next.seats - count,
    },
  })

  const params = {
    eventTitle: event.title,
    eventDate: event.startsAt.toISOString(),
    organizationId: next.organizationId,
    eventId: event.id,
    seats: count,
    waitlistSeats: next.seats - count,
  }
  // платежи мест при промоушене в pending_payment (cash/transfer) — Phase 6, 20.1.2
  if (
    event.priceMode === 'fixed' &&
    newStatus === 'pending_payment' &&
    (promotedMethod === 'cash' || promotedMethod === 'transfer')
  ) {
    await paymentService.createSeatPayments({ ...ctx, userId: next.userId }, promoted!, {
      count,
      amount: event.price,
      currency: event.currency,
      method: promotedMethod,
    })
    const linked = await paymentService.syncBookingPayments(ctx, next.id)
    collectNotification(ctx, {
      userId: next.userId,
      type: 'waitlist_promoted',
      params: { ...params, needsPayment: true },
    })
    return linked!
  }
  collectNotification(ctx, {
    userId: next.userId,
    type: event.priceMode === 'split' ? 'split_booking_reserved' : 'waitlist_promoted',
    params: { ...params, needsPayment: false },
  })
  return promoted!
}
