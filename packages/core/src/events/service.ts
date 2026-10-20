import {
  and,
  asc,
  bookings,
  desc,
  eq,
  events,
  eventSeries,
  gt,
  gte,
  inArray,
  isNotNull,
  lt,
  ne,
  or,
  organizationMembers,
  organizations,
  payments,
  sql,
  venues,
  waitlistOffers,
  type Event,
} from '@volley-time/db'
import { DEFAULT_TIMEZONE, dateToZonedInput, zonedInputToDate } from '@volley-time/shared'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { reservedSeats, revokeEventOffers } from '../bookings/offers'
import { queuePositionsOf } from '../bookings/queue-position'
import { queuedBookingsSql, queuedSeatsSql, takenSeatsSql } from '../bookings/seats'
import { eventBalanceService } from '../event-balance/service'
import { collectNotification } from '../notifier/collect'
import { OrganizationNotFoundError } from '../organizations/errors'
import { paymentService } from '../payments/service'
import { requireCanManageContent } from '../permissions/policies'
import { schedulerEnabled } from '../scheduler/capability'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'
import { CurrencyMismatchError } from '../shared/currency'
import { subscriptionService } from '../subscriptions/service'

import { syncManualCloseMark } from './booking-close'
import {
  EventError,
  EventBookingOpensAfterCloseError,
  EventBookingOpensInPastError,
  EventCapacityBelowTakenError,
  EventInviteModeDisabledError,
  EventNotEditableError,
  EventNotFoundError,
  EventSchedulerDisabledError,
  EventStartsInPastError,
  VenueNotInOrgError,
} from './errors'
import { isInviteModeEnabled } from './join-mode-capability'
import { isSplitPricingEnabled } from './pricing-capability'
import {
  CreateEventInput,
  EventPricingInput,
  ListEventsQuery,
  UpdateEventInput,
  DEFAULT_CLOSE_BEFORE_MINUTES,
  type ListEventsQuery as ListQuery,
  type CreateEventInput as CreateInput,
  type UpdateEventInput as UpdateInput,
} from './schemas'

function requireInviteModeCapability(): void {
  if (!isInviteModeEnabled(process.env.EVENT_INVITE_MODE_ENABLED)) {
    throw new EventInviteModeDisabledError()
  }
}

/**
 * Время открытия записи (20.3.1, D-09): задаётся только при включённом планировщике (новая семантика
 * за флагом, ADR v3 п. 4), в будущем и раньше начала события. `null` — открыть запись сейчас.
 */
function assertBookingOpensAt(
  opensAt: Date | null | undefined,
  startsAt: Date,
  closeBeforeMinutes: number,
): void {
  if (opensAt === undefined || opensAt === null) return
  if (!schedulerEnabled()) throw new EventSchedulerDisabledError()
  if (opensAt <= new Date()) throw new EventBookingOpensInPastError()
  assertOpensBeforeClose(opensAt, startsAt, closeBeforeMinutes)
}

/** Запись открывается не позже момента закрытия: начало − срок закрытия (ревью PR #150, I1). */
function assertOpensBeforeClose(
  opensAt: Date | null,
  startsAt: Date,
  closeBeforeMinutes: number,
): void {
  if (opensAt && opensAt.getTime() > startsAt.getTime() - closeBeforeMinutes * 60_000)
    throw new EventBookingOpensAfterCloseError()
}

function requireSplitCapability(): void {
  if (!isSplitPricingEnabled(process.env.EVENT_SPLIT_PRICING_ENABLED)) {
    throw new EventError('event.split_pricing_disabled', 'Split pricing is not enabled')
  }
}

export async function assertVenueInOrg(
  db: ReturnType<typeof getDb>,
  venueId: number,
  orgId: number,
): Promise<void> {
  const venue = await db.query.venues.findFirst({
    where: and(eq(venues.id, venueId), eq(venues.organizationId, orgId)),
    columns: { id: true },
  })
  if (!venue) throw new VenueNotInOrgError()
}

export interface EventStats {
  /** Занято мест — SUM(seats) записей в составе (20.1.2). */
  taken: number
  /** Игроков в составе — COUNT(*) тех же записей; не равно `taken` при записях на несколько мест. */
  players: number
  /** Людей (записей) в очереди: `waitlisted` и записи в основе с местами в очереди; без имён (20.4.11). */
  waitlist: number
  /** Мест в очереди: записи `waitlisted` целиком и очередная часть записей в основе. */
  waitlistSeats: number
  myBooking: {
    id: number
    status: string
    method: string
    paymentId: number | null
    seats: number
    waitlistSeats: number
    /** Активное предложение места из очереди (20.3.1, D-03): принять — POST …/waitlist-offers/{id}/accept. */
    offer: { id: number; seats: number; expiresAt: Date } | null
    /** Место в очереди (1 — первый), только у своей записи в очереди (20.4.11); иначе null. */
    waitPos: number | null
  } | null
  venue: { name: string; address: string | null } | null
}

/** Снимок настроек группы для создания события (читается под FOR SHARE, D-02, 19.2.2). */
export interface OrgEventDefaults {
  defaultCurrency: string
  defaultPriceMode: Event['priceMode']
  defaultJoinMode: Event['joinMode']
  defaultTimezone: string
  cancellationAllowed: boolean
  cancellationDeadlineHours: number | null
}

/**
 * Настройки группы под FOR SHARE: параллельное изменение настроек (FOR UPDATE) не вклинится между
 * снимком и вставкой события (D-02, 19.2.2). Вызывать в транзакции.
 */
export async function readOrgEventDefaults(
  ctx: ServiceContext,
  orgId: number,
): Promise<OrgEventDefaults> {
  const [org] = await getDb(ctx)
    .select({
      defaultCurrency: organizations.defaultCurrency,
      defaultPriceMode: organizations.defaultPriceMode,
      defaultJoinMode: organizations.defaultJoinMode,
      defaultTimezone: organizations.defaultTimezone,
      cancellationAllowed: organizations.cancellationAllowed,
      cancellationDeadlineHours: organizations.cancellationDeadlineHours,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .for('share')
  if (!org) throw new OrganizationNotFoundError(orgId)
  return org
}

/** Итоговые режимы события по умолчаниям группы; проверка выключателей возможностей. */
export function resolveEventModes(
  data: ReturnType<typeof CreateEventInput.parse>,
  org: OrgEventDefaults,
) {
  if (data.currency && data.currency.toUpperCase() !== org.defaultCurrency) {
    throw new CurrencyMismatchError(org.defaultCurrency, data.currency)
  }
  // режим оплаты — значение по умолчанию группы, которое событие может переопределить
  const pricing = EventPricingInput.parse({
    priceMode: data.priceMode ?? org.defaultPriceMode,
    price: data.price,
    targetAmount: data.targetAmount,
  })
  if (pricing.priceMode === 'split') requireSplitCapability()
  // режим записи — снимок умолчания группы, событие может переопределить (20.1.3)
  const joinMode = data.joinMode ?? org.defaultJoinMode
  if (joinMode === 'invite') requireInviteModeCapability()
  return { pricing, joinMode }
}

/**
 * Вставить событие, списать баланс при публикации и записать audit — в транзакции вызывающего.
 * Общий путь одиночного создания и дат серии (20.2.2): `series` связывает событие с датой серии.
 */
export async function insertEvent(
  ctx: ServiceContext,
  orgId: number,
  data: ReturnType<typeof CreateEventInput.parse>,
  org: OrgEventDefaults,
  series: { id: number; date: string } | null = null,
): Promise<Event> {
  const db = getDb(ctx)
  if (data.startsAt <= new Date()) throw new EventStartsInPastError() // 5.13.11
  if (data.venueId) await assertVenueInOrg(db, data.venueId, orgId)
  const { pricing, joinMode } = resolveEventModes(data, org)
  const closeBeforeMinutes = data.closeBeforeMinutes ?? DEFAULT_CLOSE_BEFORE_MINUTES
  assertBookingOpensAt(data.bookingOpensAt, data.startsAt, closeBeforeMinutes)

  const [event] = await db
    .insert(events)
    .values({
      organizationId: orgId,
      createdByUserId: ctx.userId,
      venueId: data.venueId ?? null,
      type: data.type,
      title: data.title,
      description: data.description ?? null,
      locationText: data.locationText ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      capacity: data.capacity,
      price: pricing.price,
      priceMode: pricing.priceMode,
      targetAmount: pricing.targetAmount,
      currency: org.defaultCurrency,
      // политика отмены — снимок группы; из входа не берётся (D-02)
      cancellationAllowed: org.cancellationAllowed,
      cancellationDeadlineHours: org.cancellationDeadlineHours,
      level: data.level ?? null,
      joinMode,
      status: data.status,
      seriesId: series?.id ?? null,
      seriesDate: series?.date ?? null,
      bookingOpensAt: data.bookingOpensAt ?? null,
      closeBeforeMinutes,
      // часы приложения, как у правок события: «изменено до момента закрытия» сравнивается с ними
      // (право планировщика закрыть запись, ревью PR #150, I1)
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
  // создано опубликованным уже в окне закрытия — запись ведёт организатор (follow-up 20.3.1)
  await syncManualCloseMark(db, event!, { becameOpen: event!.status === 'published' })
  // публикация списывает 1 событие баланса; нехватка откатывает создание (20.2.1, D-04)
  const spend =
    event!.status === 'published' ? await eventBalanceService.spendOnPublish(ctx, event!) : null
  await auditService.record(ctx, {
    organizationId: orgId,
    action: AUDIT_ACTIONS.EVENT_CREATED,
    entityType: 'event',
    entityId: event!.id,
    newValue: {
      title: event!.title,
      startsAt: event!.startsAt,
      capacity: event!.capacity,
      price: event!.price,
      ...(series ? { seriesId: series.id, seriesDate: series.date } : {}),
      ...(spend ? { eventBalance: { delta: spend.delta, balanceAfter: spend.balanceAfter } } : {}),
    },
  })
  return event!
}

export const eventService = {
  async create(ctx: ServiceContext, orgId: number, input: CreateInput): Promise<Event> {
    const data = CreateEventInput.parse(input)
    if (data.priceMode === 'split') requireSplitCapability()
    // мутация и audit атомарны (5.13.12)
    return inTransaction(ctx, async (ctx) => {
      if (data.startsAt <= new Date()) throw new EventStartsInPastError() // 5.13.11
      if (data.venueId) await assertVenueInOrg(getDb(ctx), data.venueId, orgId)
      const org = await readOrgEventDefaults(ctx, orgId)
      return insertEvent(ctx, orgId, data, org)
    })
  },

  async getById(ctx: ServiceContext, eventId: number): Promise<Event> {
    const ev = await getDb(ctx).query.events.findFirst({ where: eq(events.id, eventId) })
    if (!ev) throw new EventNotFoundError(eventId)
    return ev
  },

  async list(
    ctx: ServiceContext,
    orgId: number,
    query: ListQuery = {},
    access: { includeDrafts?: boolean } = {},
  ): Promise<Event[]> {
    const opts = ListEventsQuery.parse(query)
    const db = getDb(ctx)
    const now = new Date()
    const conds = [eq(events.organizationId, orgId)]
    // черновики видят только управляющие (5.13.11)
    if (!access.includeDrafts) conds.push(ne(events.status, 'draft'))
    if (opts.filter === 'upcoming') conds.push(gte(events.startsAt, now))
    if (opts.filter === 'past') conds.push(lt(events.startsAt, now))
    if (opts.status) conds.push(eq(events.status, opts.status))
    if (opts.from && opts.to) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { defaultTimezone: true },
      })
      const tz = org?.defaultTimezone ?? DEFAULT_TIMEZONE
      const nextDay = new Date(Date.parse(`${opts.to}T00:00:00Z`) + 86_400_000)
        .toISOString()
        .slice(0, 10)
      conds.push(gte(events.startsAt, zonedInputToDate(`${opts.from}T00:00`, tz)))
      conds.push(lt(events.startsAt, zonedInputToDate(`${nextDay}T00:00`, tz)))
    }
    return db.query.events.findMany({
      where: and(...conds),
      orderBy: opts.filter === 'past' ? [desc(events.startsAt)] : [asc(events.startsAt)],
      limit: opts.limit ?? (opts.from ? 500 : 50),
      offset: opts.offset,
    })
  },

  /**
   * Статистика событий для списка/страницы (Task 5.13.17): занято, в листе ожидания,
   * бронь текущего пользователя, название площадки — одним запросом на пачку событий.
   */
  async statsFor(ctx: ServiceContext, eventIds: number[]): Promise<Map<number, EventStats>> {
    const out = new Map<number, EventStats>()
    if (eventIds.length === 0) return out
    const db = getDb(ctx)
    const now = new Date()
    const counts = await db
      .select({
        eventId: bookings.eventId,
        taken: takenSeatsSql,
        players: sql<number>`count(*) FILTER (WHERE ${bookings.status} IN ('confirmed','pending_payment','attended','no_show'))::int`,
        waitlist: queuedBookingsSql,
        waitlistSeats: queuedSeatsSql,
      })
      .from(bookings)
      .where(inArray(bookings.eventId, eventIds))
      .groupBy(bookings.eventId)
    const mine = await db
      .select({
        id: bookings.id,
        eventId: bookings.eventId,
        status: bookings.status,
        method: bookings.method,
        paymentId: bookings.paymentId,
        seats: bookings.seats,
        waitlistSeats: bookings.waitlistSeats,
      })
      .from(bookings)
      .where(and(inArray(bookings.eventId, eventIds), eq(bookings.userId, ctx.userId)))
    const myOffers = mine.length
      ? await db
          .select({
            id: waitlistOffers.id,
            bookingId: waitlistOffers.bookingId,
            seats: waitlistOffers.seats,
            expiresAt: waitlistOffers.expiresAt,
          })
          .from(waitlistOffers)
          .where(
            and(
              inArray(
                waitlistOffers.bookingId,
                mine.map((m) => m.id),
              ),
              eq(waitlistOffers.status, 'offered'),
              // истёкшее, но не обработанное предложение не показывается: игрок покидает очередь (20.4.11)
              gt(waitlistOffers.expiresAt, now),
            ),
          )
      : []
    const venueRows = await db
      .select({ eventId: events.id, name: venues.name, address: venues.address })
      .from(events)
      .innerJoin(venues, eq(venues.id, events.venueId))
      .where(inArray(events.id, eventIds))
    const positions = await queuePositionsOf(db, ctx.userId, eventIds, now)
    for (const id of eventIds)
      out.set(id, {
        taken: 0,
        players: 0,
        waitlist: 0,
        waitlistSeats: 0,
        myBooking: null,
        venue: null,
      })
    for (const c of counts)
      Object.assign(out.get(c.eventId)!, {
        taken: c.taken,
        players: c.players,
        waitlist: c.waitlist,
        waitlistSeats: c.waitlistSeats,
      })
    for (const m of mine)
      out.get(m.eventId)!.myBooking = {
        id: m.id,
        status: m.status,
        method: m.method,
        paymentId: m.paymentId,
        seats: m.seats,
        waitlistSeats: m.waitlistSeats,
        offer: null,
        waitPos: positions.get(m.id) ?? null,
      }
    for (const o of myOffers) {
      const mineRow = mine.find((m) => m.id === o.bookingId)
      if (mineRow)
        out.get(mineRow.eventId)!.myBooking!.offer = {
          id: o.id,
          seats: o.seats,
          expiresAt: o.expiresAt,
        }
    }
    for (const v of venueRows) out.get(v.eventId)!.venue = { name: v.name, address: v.address }
    return out
  },

  async update(ctx: ServiceContext, eventId: number, input: UpdateInput): Promise<Event> {
    // cancellationDeadlineHours игнорируется: политика отмены меняется только в группе (D-02)
    const data = UpdateEventInput.parse(input)
    delete data.cancellationDeadlineHours
    // мутация и audit атомарны (5.13.12)
    return inTransaction(ctx, async (ctx) => {
      const db = getDb(ctx)
      // Same lock as bookings/settlement, before reading any financial state.
      await db.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)
      const [existing] = await db.select().from(events).where(eq(events.id, eventId)).for('update')
      if (!existing) throw new EventNotFoundError(eventId)
      if (existing.status === 'cancelled' || existing.status === 'finished') {
        throw new EventNotEditableError()
      }
      if (
        data.priceMode !== undefined ||
        data.price !== undefined ||
        data.targetAmount !== undefined
      ) {
        const member = await db.query.organizationMembers.findFirst({
          where: and(
            eq(organizationMembers.organizationId, existing.organizationId),
            eq(organizationMembers.userId, ctx.userId),
          ),
        })
        requireCanManageContent(member ?? null)
      }
      const priceMode = data.priceMode ?? existing.priceMode
      if (priceMode !== existing.priceMode) {
        const history = await db.query.bookings.findFirst({
          where: eq(bookings.eventId, eventId),
          columns: { id: true },
        })
        if (history || existing.pricingSettledAt !== null) {
          throw new EventError(
            'event.pricing_locked',
            'Pricing mode cannot change after booking history or settlement',
          )
        }
        if (priceMode === 'split') requireSplitCapability()
      }
      const pricing = EventPricingInput.parse({
        priceMode,
        price: data.price ?? existing.price,
        targetAmount: data.targetAmount === undefined ? existing.targetAmount : data.targetAmount,
      })
      if (existing.pricingSettledAt !== null && pricing.targetAmount !== existing.targetAmount) {
        throw new EventError('event.pricing_locked', 'Split target cannot change after settlement')
      }
      if (priceMode === 'split') {
        const status = data.status ?? existing.status
        if (existing.pricingSettledAt === null && (status === 'closed' || status === 'finished')) {
          throw new EventError(
            'event.settlement_required',
            'Split pricing must be settled before closing or finishing',
          )
        }
        if (
          existing.pricingSettledAt !== null &&
          (data.status === 'published' || data.status === 'draft')
        ) {
          throw new EventError(
            'event.pricing_locked',
            'Settled split registration cannot be reopened',
          )
        }
      }
      if (data.venueId) await assertVenueInOrg(db, data.venueId, existing.organizationId)
      // переключение в invite — под тем же lock события, что и запись (20.1.3)
      if (data.joinMode === 'invite' && existing.joinMode !== 'invite') {
        requireInviteModeCapability()
      }

      // валидация времени если оба переданы или один
      const startsAt = data.startsAt ?? existing.startsAt
      const endsAt = data.endsAt ?? existing.endsAt
      if (endsAt <= startsAt) {
        throw new EventNotEditableError()
      }
      if (data.startsAt && data.startsAt <= new Date()) throw new EventStartsInPastError()
      // время открытия записи (20.3.1, D-09): новое значение проверяется целиком
      const closeBeforeMinutes = data.closeBeforeMinutes ?? existing.closeBeforeMinutes
      if (
        data.bookingOpensAt !== undefined &&
        data.bookingOpensAt !== null &&
        data.bookingOpensAt.getTime() !== existing.bookingOpensAt?.getTime()
      ) {
        assertBookingOpensAt(data.bookingOpensAt, startsAt, closeBeforeMinutes)
        // открытую запись не «закрыть обратно»: иначе отмена события вернула бы баланс вопреки
        // записям (D-09, D-13)
        const active = await db.query.bookings.findFirst({
          where: and(eq(bookings.eventId, eventId), ne(bookings.status, 'cancelled')),
          columns: { id: true },
        })
        if (active)
          throw new EventError('event.booking_already_open', 'Booking already has participants')
      }
      const opensAt =
        data.bookingOpensAt === undefined ? existing.bookingOpensAt : data.bookingOpensAt
      // ещё не наступившее открытие должно остаться не позже момента закрытия при сдвиге начала
      // или срока закрытия; уже открытой записи это не касается
      if (opensAt && opensAt > new Date())
        assertOpensBeforeClose(opensAt, startsAt, closeBeforeMinutes)
      // дата серии (20.2.2): время события меняется свободно, календарный день — только правкой
      // серии, иначе `series_date` разошёлся бы с фактическим днём события
      if (existing.seriesId !== null && data.startsAt !== undefined) {
        const [series] = await db
          .select({ timezone: eventSeries.timezone })
          .from(eventSeries)
          .where(eq(eventSeries.id, existing.seriesId))
        const tz = series?.timezone ?? DEFAULT_TIMEZONE
        if (dateToZonedInput(data.startsAt, tz).slice(0, 10) !== existing.seriesDate) {
          throw new EventError(
            'event.series_date_locked',
            'The calendar day of a series event changes only through the series',
          )
        }
      }

      // вместимость не ниже занятых мест — SUM(seats) (5.13.11, 20.1.2) и мест под активными
      // предложениями из очереди (20.3.1)
      if (data.capacity !== undefined) {
        const taken = await reservedSeats(db, eventId)
        if (data.capacity < taken) throw new EventCapacityBelowTakenError(taken)
      }

      const [updated] = await db
        .update(events)
        .set({ ...data, ...pricing, updatedAt: new Date() })
        .where(eq(events.id, eventId))
        .returning()
      // запись больше не открыта (закрыта, завершена, снята в черновик): предложения мест из
      // очереди снимаются (20.3.1)
      if (updated!.status !== 'published') await revokeEventOffers(db, eventId)
      // опубликовано или переоткрыто в окне закрытия — запись ведёт организатор; перенос, после
      // которого момент закрытия снова в будущем, снимает метку (follow-up 20.3.1)
      // публикация, переоткрытие, перенос начала или смена срока, после которых момент закрытия уже
      // в прошлом, — запись ведёт организатор (метка, без отказа; решение координатора 2026-10-16)
      await syncManualCloseMark(db, updated!, {
        becameOpen:
          (existing.status !== 'published' && updated!.status === 'published') ||
          updated!.startsAt.getTime() !== existing.startsAt.getTime() ||
          updated!.closeBeforeMinutes !== existing.closeBeforeMinutes,
      })
      // списывает только переход в published (публикация черновика, D-04); черновик, сразу
      // закрытый или завершённый, не публиковался. Порядок блокировок: событие → баланс
      const spend =
        existing.status === 'draft' && updated!.status === 'published'
          ? await eventBalanceService.spendOnPublish(ctx, updated!)
          : null
      await auditService.record(ctx, {
        organizationId: existing.organizationId,
        action: AUDIT_ACTIONS.EVENT_UPDATED,
        entityType: 'event',
        entityId: eventId,
        newValue: spend
          ? { ...data, eventBalance: { delta: spend.delta, balanceAfter: spend.balanceAfter } }
          : data,
      })
      return updated!
    })
  },

  /**
   * Отменить событие с массовым возвратом (Phase 6.4).
   * Для каждой активной брони: restore сессии абонемента, refund/cancel платежа,
   * booking -> cancelled. БЕЗ promotion (событие отменено целиком). Idempotent.
   */
  async cancel(ctx: ServiceContext, eventId: number): Promise<Event> {
    const db = getDb(ctx)
    return db.transaction(async (tx) => {
      // сериализация с записью/отменой броней и параллельной отменой события (6.8.2)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)
      const [locked] = await tx.select().from(events).where(eq(events.id, eventId)).for('update')
      if (!locked) throw new EventNotFoundError(eventId)
      const existing = locked
      if (existing.status === 'cancelled') return existing

      // возврат баланса (D-09, D-13) решается и проводится ДО цикла отмены записей: после цикла все
      // записи уже cancelled. Порядок блокировок: событие → баланс → платежи/абонементы (ADR, п. 7).
      const refund = await eventBalanceService.refundOnCancel({ ...ctx, db: tx }, existing)

      const activeBookings = await tx.query.bookings.findMany({
        where: and(
          eq(bookings.eventId, eventId),
          existing.priceMode === 'split'
            ? or(ne(bookings.status, 'cancelled'), isNotNull(bookings.allocatedAmount))
            : ne(bookings.status, 'cancelled'),
        ),
      })

      for (const b of activeBookings) {
        let refunded = false
        // 1. вернуть занятия абонемента — по месту (только списанные: у waitlisted это лишь выбор, 5.13.6)
        // места сверх живых платежей — занятия; места из очереди без занятий оплачены наличными
        const subscriptionSeats =
          b.method === 'subscription' &&
          b.subscriptionId &&
          ['confirmed', 'pending_payment', 'attended', 'no_show'].includes(b.status)
            ? b.seats - (await paymentService.listLive({ ...ctx, db: tx }, b)).length
            : 0
        if (subscriptionSeats > 0) {
          await subscriptionService.restoreSessions(
            { userId: b.userId, db: tx },
            b.subscriptionId!,
            subscriptionSeats,
          )
          refunded = true
        }

        // 2. платежи мест (ADR v3, D-14): fixed — succeeded-живые платежи неотменённой записи
        // возвращаются, освобождённые игроком места — нет; split — дополнительно зафиксированная доля
        // текущего воплощения возвращается и при освобождённом месте (как R0.7 с allocated_amount).
        // pending-платежи текущего воплощения отменяются. Переходы условные (6.8.1).
        const owned = await tx
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.bookingId, b.id),
              eq(payments.bookingIncarnation, b.incarnation),
              inArray(payments.status, ['pending', 'succeeded']),
            ),
          )
          .orderBy(asc(payments.id))
          .for('update')
        for (const payment of owned) {
          const refundable =
            b.status !== 'cancelled'
              ? payment.seatReleasedAt === null ||
                (existing.priceMode === 'split' && b.allocatedAmount !== null)
              : existing.priceMode === 'split' && b.allocatedAmount !== null
          if (payment.status === 'succeeded' && refundable) {
            await paymentService.refund({ ...ctx, db: tx }, payment.id, 'Отмена события')
            refunded = true
          } else if (payment.status === 'pending') {
            await tx
              .update(payments)
              .set({ status: 'cancelled' })
              .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
          }
        }

        // 3. бронь -> cancelled (без promotion: событие отменено)
        await tx
          .update(bookings)
          .set({
            status: 'cancelled',
            waitlistSeats: 0,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, b.id))

        collectNotification(ctx, {
          userId: b.userId,
          type: 'event_cancelled',
          params: {
            eventTitle: existing.title,
            eventDate: existing.startsAt.toISOString(),
            organizationId: existing.organizationId,
            eventId: existing.id,
            refunded,
          },
        })
      }

      // предложения мест снимаются; задачи журнала отменённого события пропускаются проверкой
      // актуальности при доставке (20.3.1)
      await revokeEventOffers(tx, eventId)
      const [cancelled] = await tx
        .update(events)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(events.id, eventId))
        .returning()
      await auditService.record(
        { ...ctx, db: tx },
        {
          organizationId: existing.organizationId,
          action: AUDIT_ACTIONS.EVENT_CANCELLED,
          entityType: 'event',
          entityId: eventId,
          newValue: {
            cancelledBookings: activeBookings.length,
            ...(refund
              ? { eventBalance: { delta: refund.delta, balanceAfter: refund.balanceAfter } }
              : {}),
          },
        },
      )
      return cancelled!
    })
  },
}
