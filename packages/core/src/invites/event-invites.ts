import {
  and,
  asc,
  bookings,
  desc,
  eq,
  eventInviteRequests,
  events,
  gt,
  inviteLinks,
  isNotNull,
  isNull,
  ne,
  or,
  organizationMembers,
  sql,
  users,
  type Event,
  type EventInviteRequest,
  type InviteLink,
} from '@volley-time/db'
import { buildEventInviteStartParam } from '@volley-time/shared'
import { nanoid } from 'nanoid'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import {
  AlreadyBookedError,
  BookingInviteRequiredError,
  EventNotBookableError,
} from '../bookings/errors'
import { EventJoinModeOpenError, EventNotFoundError } from '../events/errors'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import {
  InviteExpiredError,
  InviteRequestAlreadyPendingError,
  InviteRequestNotFoundError,
  InviteRequestNotPendingError,
} from './errors'

/** 24 символа алфавита nanoid (64) ≈ 144 бита: перебор токена бессмыслен. */
const EVENT_INVITE_TOKEN_LENGTH = 24
/** Срок личной ссылки — не больше 30 суток и не дольше начала события. */
const MAX_EXPIRES_IN_HOURS = 24 * 30

export const CreateEventInviteInput = z
  .object({ expiresInHours: z.number().int().min(1).max(MAX_EXPIRES_IN_HOURS).optional() })
  .strict()
export type CreateEventInviteInput = z.input<typeof CreateEventInviteInput>

export const CreateInviteRequestInput = z
  .object({ message: z.string().trim().max(500).optional() })
  .strict()
export type CreateInviteRequestInput = z.input<typeof CreateInviteRequestInput>

export interface EventInviteRequestView {
  id: number
  eventId: number
  status: EventInviteRequest['status']
  message: string | null
  createdAt: Date
  decidedAt: Date | null
  decidedByUserId: number | null
  inviteId: number | null
  /** Только публичные поля игрока: без email, телефона и Telegram id (5.13.2). */
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
}

type Db = ReturnType<typeof getDb>

/**
 * Событие группы под FOR SHARE: отмена и правка события (FOR UPDATE) не вклинятся между проверкой
 * и выдачей приглашения. Чужое событие неотличимо от несуществующего (IDOR); черновик скрыт от
 * игроков.
 */
async function lockGroupEvent(
  db: Db,
  orgId: number,
  eventId: number,
  opts: { includeDrafts: boolean },
): Promise<Event> {
  const [ev] = await db.select().from(events).where(eq(events.id, eventId)).for('share')
  if (!ev || ev.organizationId !== orgId || (ev.status === 'draft' && !opts.includeDrafts)) {
    throw new EventNotFoundError(eventId)
  }
  return ev
}

/** Приглашение выдаётся только событию `invite`, на которое ещё можно записаться. */
function assertInvitable(ev: Event): void {
  if (ev.status !== 'draft' && ev.status !== 'published') {
    throw new EventNotBookableError(ev.status === 'cancelled' ? 'cancelled' : 'not open')
  }
  if (ev.startsAt <= new Date()) throw new EventNotBookableError('already started')
  if (ev.joinMode !== 'invite') throw new EventJoinModeOpenError()
}

/** Однократная личная ссылка на событие; срок — не позже начала события. */
async function issueInvite(
  ctx: ServiceContext,
  ev: Event,
  opts: { expiresInHours?: number; requestId?: number } = {},
): Promise<InviteLink> {
  const db = getDb(ctx)
  const requested = opts.expiresInHours
    ? new Date(Date.now() + opts.expiresInHours * 3600_000)
    : ev.startsAt
  const expiresAt = requested < ev.startsAt ? requested : ev.startsAt
  const [inv] = await db
    .insert(inviteLinks)
    .values({
      token: nanoid(EVENT_INVITE_TOKEN_LENGTH),
      organizationId: ev.organizationId,
      eventId: ev.id,
      type: 'event_join',
      createdByUserId: ctx.userId,
      maxUses: 1,
      expiresAt,
    })
    .returning()
  await auditService.record(ctx, {
    organizationId: ev.organizationId,
    action: AUDIT_ACTIONS.INVITE_CREATED,
    entityType: 'invite',
    entityId: inv!.id,
    newValue: {
      type: 'event_join',
      eventId: ev.id,
      maxUses: 1,
      expiresAt,
      ...(opts.requestId ? { inviteRequestId: opts.requestId } : {}),
    },
  })
  return inv!
}

/** Приглашение этого события, по которому ещё можно записаться (не отозвано, не истекло, не использовано). */
function usableInviteOf(ev: Event) {
  return and(
    eq(inviteLinks.type, 'event_join'),
    eq(inviteLinks.eventId, ev.id),
    eq(inviteLinks.organizationId, ev.organizationId),
    eq(inviteLinks.isRevoked, false),
    or(isNull(inviteLinks.expiresAt), gt(inviteLinks.expiresAt, new Date())),
    sql`(${inviteLinks.maxUses} IS NULL OR ${inviteLinks.usesCount} < ${inviteLinks.maxUses})`,
  )
}

/** Истёк ли срок приглашения, которое в остальном было бы годным (состояние «ссылка просрочена»). */
const onlyExpired = (inv: InviteLink | undefined): boolean =>
  !!inv &&
  !inv.isRevoked &&
  inv.expiresAt !== null &&
  inv.expiresAt <= new Date() &&
  (inv.maxUses === null || inv.usesCount < inv.maxUses)

/**
 * Право на запись на событие `invite` (20.1.3). Вызывается сервисом записи внутри его транзакции под
 * advisory-lock события; израсходование приглашения — условный инкремент `uses_count` (как redeem
 * 4.9.3), поэтому однократная ссылка пропускает ровно одну запись при любой конкуренции, а
 * откат транзакции записи возвращает приглашение. Источники по порядку:
 * 1. `inviteToken` из тела — личная ссылка этого события;
 * 2. приглашение, по которому создана отменённая запись этого игрока (повторная запись);
 * 3. приглашение, выданное игроку одобрением его запроса.
 * Чужой, неизвестный, отозванный или использованный токен — `booking.invite_required` (без
 * раскрытия причины); просроченная ссылка этого события — `invite.expired`.
 * @returns id приглашения для `bookings.invite_id`
 */
export async function consumeEventInvite(
  ctx: ServiceContext,
  ev: Event,
  opts: { inviteToken?: string; previousInviteId?: number | null },
): Promise<number> {
  const db = getDb(ctx)
  if (opts.inviteToken) {
    const [inv] = await db
      .update(inviteLinks)
      .set({ usesCount: sql`${inviteLinks.usesCount} + 1` })
      .where(and(eq(inviteLinks.token, opts.inviteToken), usableInviteOf(ev)))
      .returning({ id: inviteLinks.id })
    if (inv) return inv.id
    const known = await db.query.inviteLinks.findFirst({
      where: and(
        eq(inviteLinks.token, opts.inviteToken),
        eq(inviteLinks.type, 'event_join'),
        eq(inviteLinks.eventId, ev.id),
        eq(inviteLinks.organizationId, ev.organizationId),
      ),
    })
    if (onlyExpired(known)) throw new InviteExpiredError()
    throw new BookingInviteRequiredError()
  }
  if (opts.previousInviteId) return opts.previousInviteId

  const approved = await db
    .select({ inviteId: eventInviteRequests.inviteId })
    .from(eventInviteRequests)
    .where(
      and(
        eq(eventInviteRequests.eventId, ev.id),
        eq(eventInviteRequests.userId, ctx.userId),
        eq(eventInviteRequests.status, 'approved'),
        isNotNull(eventInviteRequests.inviteId),
      ),
    )
    .orderBy(desc(eventInviteRequests.decidedAt))
  let expired = false
  for (const { inviteId } of approved) {
    const [inv] = await db
      .update(inviteLinks)
      .set({ usesCount: sql`${inviteLinks.usesCount} + 1` })
      .where(and(eq(inviteLinks.id, inviteId!), usableInviteOf(ev)))
      .returning({ id: inviteLinks.id })
    if (inv) return inv.id
    const known = await db.query.inviteLinks.findFirst({ where: eq(inviteLinks.id, inviteId!) })
    expired ||= onlyExpired(known)
  }
  if (expired) throw new InviteExpiredError()
  throw new BookingInviteRequiredError()
}

function toView(
  row: EventInviteRequest,
  user: EventInviteRequestView['user'],
): EventInviteRequestView {
  return {
    id: row.id,
    eventId: row.eventId,
    status: row.status,
    message: row.message,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    decidedByUserId: row.decidedByUserId,
    inviteId: row.inviteId,
    user,
  }
}

export const eventInviteService = {
  /**
   * Личная ссылка-приглашение на событие `invite` (POST …/events/{id}/invites, manager): однократная,
   * срок — `expiresInHours` или до начала события. `startParam` — параметр startapp Mini App
   * `event_<eventId>_<token>`: Mini App сразу открывает событие и передаёт токен в запись.
   */
  async create(
    ctx: ServiceContext,
    orgId: number,
    eventId: number,
    input: CreateEventInviteInput = {},
  ): Promise<{ invite: InviteLink; startParam: string }> {
    const data = CreateEventInviteInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const ev = await lockGroupEvent(getDb(tx), orgId, eventId, { includeDrafts: true })
      assertInvitable(ev)
      const invite = await issueInvite(tx, ev, { expiresInHours: data.expiresInHours })
      return { invite, startParam: buildEventInviteStartParam(ev.id, invite.token) }
    })
  },
}

export const eventInviteRequestService = {
  /**
   * Запрос приглашения от игрока (POST …/events/{id}/invite-requests, member). Один ожидающий
   * запрос на игрока и событие (частичный UNIQUE); после отказа можно спросить снова.
   */
  async request(
    ctx: ServiceContext,
    orgId: number,
    eventId: number,
    input: CreateInviteRequestInput = {},
  ): Promise<EventInviteRequest> {
    const data = CreateInviteRequestInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const ev = await lockGroupEvent(db, orgId, eventId, { includeDrafts: false })
      if (ev.status !== 'published') throw new EventNotBookableError('not open')
      if (ev.startsAt <= new Date()) throw new EventNotBookableError('already started')
      if (ev.joinMode !== 'invite') throw new EventJoinModeOpenError()
      const member = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, ctx.userId),
        ),
        columns: { status: true },
      })
      if (member?.status !== 'active') throw new EventNotBookableError('not a member')
      const booked = await db.query.bookings.findFirst({
        where: and(
          eq(bookings.eventId, eventId),
          eq(bookings.userId, ctx.userId),
          ne(bookings.status, 'cancelled'),
        ),
        columns: { id: true },
      })
      if (booked) throw new AlreadyBookedError()

      const [created] = await db
        .insert(eventInviteRequests)
        .values({
          organizationId: orgId,
          eventId,
          userId: ctx.userId,
          message: data.message || null,
        })
        // параллельный запрос того же игрока ждёт и не создаёт второй pending
        .onConflictDoNothing({
          target: [eventInviteRequests.eventId, eventInviteRequests.userId],
          where: sql`status = 'pending'`,
        })
        .returning()
      if (!created) throw new InviteRequestAlreadyPendingError()
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.EVENT_INVITE_REQUEST_CREATED,
        entityType: 'event_invite_request',
        entityId: created.id,
        newValue: { eventId },
      })
      return created
    })
  },

  /** Запросы события для организатора (GET …/invite-requests, manager): сначала старые. */
  async list(
    ctx: ServiceContext,
    orgId: number,
    eventId: number,
  ): Promise<EventInviteRequestView[]> {
    const db = getDb(ctx)
    const ev = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { organizationId: true },
    })
    if (!ev || ev.organizationId !== orgId) throw new EventNotFoundError(eventId)
    const rows = await db
      .select({
        request: eventInviteRequests,
        user: {
          id: users.id,
          name: users.name,
          telegramUsername: users.telegramUsername,
          image: users.image,
        },
      })
      .from(eventInviteRequests)
      .innerJoin(users, eq(users.id, eventInviteRequests.userId))
      .where(
        and(
          eq(eventInviteRequests.eventId, eventId),
          eq(eventInviteRequests.organizationId, orgId),
        ),
      )
      .orderBy(asc(eventInviteRequests.createdAt), asc(eventInviteRequests.id))
    return rows.map((r) => toView(r.request, r.user))
  },

  /** Одобрить: выдать игроку однократное приглашение до начала события (manager). */
  async approve(
    ctx: ServiceContext,
    orgId: number,
    eventId: number,
    requestId: number,
  ): Promise<EventInviteRequest> {
    return decide(ctx, orgId, eventId, requestId, 'approved')
  },

  /** Отклонить запрос (manager); игрок может запросить снова. */
  async decline(
    ctx: ServiceContext,
    orgId: number,
    eventId: number,
    requestId: number,
  ): Promise<EventInviteRequest> {
    return decide(ctx, orgId, eventId, requestId, 'declined')
  },

  /** Последний запрос текущего игрока на событие — для состояний Mini App (20.4.7). */
  async mine(
    ctx: ServiceContext,
    eventId: number,
  ): Promise<{ id: number; status: EventInviteRequest['status']; createdAt: Date } | null> {
    const [row] = await getDb(ctx)
      .select({
        id: eventInviteRequests.id,
        status: eventInviteRequests.status,
        createdAt: eventInviteRequests.createdAt,
      })
      .from(eventInviteRequests)
      .where(
        and(eq(eventInviteRequests.eventId, eventId), eq(eventInviteRequests.userId, ctx.userId)),
      )
      .orderBy(desc(eventInviteRequests.createdAt), desc(eventInviteRequests.id))
      .limit(1)
    return row ?? null
  },
}

/**
 * Решение по запросу. Переход только из `pending` — условным UPDATE: параллельные решения
 * сериализуются блокировкой строки, второе получает `invite_request.not_pending`. Запрос другого
 * события или группы неотличим от несуществующего (404).
 */
async function decide(
  outer: ServiceContext,
  orgId: number,
  eventId: number,
  requestId: number,
  status: 'approved' | 'declined',
): Promise<EventInviteRequest> {
  return inTransaction(outer, async (ctx) => {
    const db = getDb(ctx)
    const ev = await lockGroupEvent(db, orgId, eventId, { includeDrafts: true })
    const [updated] = await db
      .update(eventInviteRequests)
      .set({ status, decidedByUserId: ctx.userId, decidedAt: new Date() })
      .where(
        and(
          eq(eventInviteRequests.id, requestId),
          eq(eventInviteRequests.eventId, eventId),
          eq(eventInviteRequests.organizationId, orgId),
          eq(eventInviteRequests.status, 'pending'),
        ),
      )
      .returning()
    if (!updated) {
      const exists = await db.query.eventInviteRequests.findFirst({
        where: and(
          eq(eventInviteRequests.id, requestId),
          eq(eventInviteRequests.eventId, eventId),
          eq(eventInviteRequests.organizationId, orgId),
        ),
        columns: { id: true },
      })
      if (exists) throw new InviteRequestNotPendingError()
      throw new InviteRequestNotFoundError()
    }
    let result = updated
    if (status === 'approved') {
      assertInvitable(ev)
      const invite = await issueInvite(ctx, ev, { requestId })
      const [linked] = await db
        .update(eventInviteRequests)
        .set({ inviteId: invite.id })
        .where(eq(eventInviteRequests.id, requestId))
        .returning()
      result = linked!
    }
    await auditService.record(ctx, {
      organizationId: orgId,
      action:
        status === 'approved'
          ? AUDIT_ACTIONS.EVENT_INVITE_REQUEST_APPROVED
          : AUDIT_ACTIONS.EVENT_INVITE_REQUEST_DECLINED,
      entityType: 'event_invite_request',
      entityId: requestId,
      oldValue: { status: 'pending' },
      newValue: { status, eventId, inviteId: result.inviteId },
    })
    return result
  })
}
