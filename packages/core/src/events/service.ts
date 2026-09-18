import {
  and,
  asc,
  bookings,
  desc,
  eq,
  events,
  gte,
  inArray,
  lt,
  ne,
  payments,
  sql,
  venues,
  type Event,
} from '@volley-time/db'

import { collectNotification } from '../notifier/collect'
import { paymentService } from '../payments/service'
import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'
import { resolveOrgCurrency } from '../shared/currency'
import { subscriptionService } from '../subscriptions/service'

import {
  EventCapacityBelowTakenError,
  EventNotEditableError,
  EventNotFoundError,
  EventStartsInPastError,
  VenueNotInOrgError,
} from './errors'
import {
  CreateEventInput,
  ListEventsQuery,
  UpdateEventInput,
  type ListEventsQuery as ListQuery,
  type CreateEventInput as CreateInput,
  type UpdateEventInput as UpdateInput,
} from './schemas'

async function assertVenueInOrg(
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
  taken: number
  waitlist: number
  myBooking: { id: number; status: string; method: string; paymentId: number | null } | null
  venue: { name: string; address: string | null } | null
}

export const eventService = {
  async create(ctx: ServiceContext, orgId: number, input: CreateInput): Promise<Event> {
    const data = CreateEventInput.parse(input)
    // мутация и audit атомарны (5.13.12)
    return inTransaction(ctx, async (ctx) => {
      const db = getDb(ctx)
      if (data.startsAt <= new Date()) throw new EventStartsInPastError() // 5.13.11
      if (data.venueId) await assertVenueInOrg(db, data.venueId, orgId)

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
          price: data.price,
          currency: await resolveOrgCurrency(ctx, orgId, data.currency),
          cancellationDeadlineHours: data.cancellationDeadlineHours ?? null,
          status: data.status,
        })
        .returning()
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
        },
      })
      return event!
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
    return db.query.events.findMany({
      where: and(...conds),
      orderBy: opts.filter === 'past' ? [desc(events.startsAt)] : [asc(events.startsAt)],
      limit: opts.limit,
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
    const counts = await db
      .select({
        eventId: bookings.eventId,
        taken: sql<number>`count(*) FILTER (WHERE ${bookings.status} IN ('confirmed','pending_payment','attended','no_show'))::int`,
        waitlist: sql<number>`count(*) FILTER (WHERE ${bookings.status} = 'waitlisted')::int`,
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
      })
      .from(bookings)
      .where(
        and(
          inArray(bookings.eventId, eventIds),
          eq(bookings.userId, ctx.userId),
          ne(bookings.status, 'cancelled'),
        ),
      )
    const venueRows = await db
      .select({ eventId: events.id, name: venues.name, address: venues.address })
      .from(events)
      .innerJoin(venues, eq(venues.id, events.venueId))
      .where(inArray(events.id, eventIds))
    for (const id of eventIds) out.set(id, { taken: 0, waitlist: 0, myBooking: null, venue: null })
    for (const c of counts)
      Object.assign(out.get(c.eventId)!, { taken: c.taken, waitlist: c.waitlist })
    for (const m of mine)
      out.get(m.eventId)!.myBooking = {
        id: m.id,
        status: m.status,
        method: m.method,
        paymentId: m.paymentId,
      }
    for (const v of venueRows) out.get(v.eventId)!.venue = { name: v.name, address: v.address }
    return out
  },

  async update(ctx: ServiceContext, eventId: number, input: UpdateInput): Promise<Event> {
    const data = UpdateEventInput.parse(input)
    // мутация и audit атомарны (5.13.12)
    return inTransaction(ctx, async (ctx) => {
      const db = getDb(ctx)
      const existing = await this.getById(ctx, eventId)
      if (existing.status === 'cancelled' || existing.status === 'finished') {
        throw new EventNotEditableError()
      }
      if (data.venueId) await assertVenueInOrg(db, data.venueId, existing.organizationId)

      // валидация времени если оба переданы или один
      const startsAt = data.startsAt ?? existing.startsAt
      const endsAt = data.endsAt ?? existing.endsAt
      if (endsAt <= startsAt) {
        throw new EventNotEditableError()
      }
      if (data.startsAt && data.startsAt <= new Date()) throw new EventStartsInPastError()

      // вместимость не ниже занятых мест (5.13.11)
      if (data.capacity !== undefined) {
        const [row] = await db
          .select({ taken: sql<number>`count(*)::int` })
          .from(bookings)
          .where(
            and(
              eq(bookings.eventId, eventId),
              sql`${bookings.status} IN ('confirmed', 'pending_payment')`,
            ),
          )
        if (data.capacity < (row?.taken ?? 0)) throw new EventCapacityBelowTakenError(row!.taken)
      }

      const [updated] = await db
        .update(events)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(events.id, eventId))
        .returning()
      await auditService.record(ctx, {
        organizationId: existing.organizationId,
        action: AUDIT_ACTIONS.EVENT_UPDATED,
        entityType: 'event',
        entityId: eventId,
        newValue: data,
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

      const activeBookings = await tx.query.bookings.findMany({
        where: and(eq(bookings.eventId, eventId), ne(bookings.status, 'cancelled')),
      })

      for (const b of activeBookings) {
        // 1. вернуть сессию абонемента (только списанную: у waitlisted это лишь выбор, 5.13.6)
        if (b.subscriptionId && ['confirmed', 'attended', 'no_show'].includes(b.status)) {
          await subscriptionService.restoreSession({ userId: b.userId, db: tx }, b.subscriptionId)
        }

        // 2. платёж: succeeded -> refund (ledger expense), pending -> cancel
        if (b.paymentId) {
          const payment = await tx.query.payments.findFirst({
            where: eq(payments.id, b.paymentId),
          })
          // переходы условные (6.8.1): повторный возврат невозможен даже без лока
          if (payment?.status === 'succeeded' && payment.bookingId === b.id) {
            await paymentService.refund({ ...ctx, db: tx }, payment.id, 'Отмена события')
          } else if (payment?.status === 'pending') {
            await tx
              .update(payments)
              .set({ status: 'cancelled' })
              .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
          }
        }

        // 3. бронь -> cancelled (без promotion: событие отменено)
        await tx
          .update(bookings)
          .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
          .where(eq(bookings.id, b.id))

        collectNotification(ctx, {
          userId: b.userId,
          type: 'event_cancelled',
          params: {
            eventTitle: existing.title,
            eventDate: existing.startsAt.toISOString(),
            organizationId: existing.organizationId,
            eventId: existing.id,
            refunded: !!b.paymentId || !!b.subscriptionId,
          },
        })
      }

      // TODO(Phase 7.3): credit refund; (Phase 15): cancel scheduled jobs
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
          newValue: { cancelledBookings: activeBookings.length },
        },
      )
      return cancelled!
    })
  },
}
