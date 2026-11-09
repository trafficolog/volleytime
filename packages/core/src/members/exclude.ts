import {
  and,
  asc,
  bookings,
  eq,
  eventInviteRequests,
  events,
  gt,
  inArray,
  inviteLinks,
  isNull,
  or,
  organizationMembers,
  organizations,
  sql,
  users,
  type OrganizationMember,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { bookingService } from '../bookings/service'
import { eventInviteRequestService } from '../invites/event-invites'
import { collectNotification } from '../notifier/collect'
import { paymentService } from '../payments/service'
import { requireCanExclude } from '../permissions/policies'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import {
  CannotExcludeOwnerError,
  CannotExcludeSelfError,
  MemberInvalidTransitionError,
  MemberNotFoundError,
} from './errors'
import { ExcludeMemberInput } from './schemas'
import { memberService } from './service'

/** Исключить можно действующего участника; заявка отклоняется, заблокированный остаётся заблокированным. */
const EXCLUDABLE_STATUSES: OrganizationMember['status'][] = ['active', 'guest']

export interface ExcludeMemberResult {
  member: OrganizationMember
  /** Отменённые будущие записи (места освобождены, очередь продвинута). */
  cancelledBookings: number
  /** Оплаченные места отменённых записей: деньги не возвращаются автоматически (D-14). */
  paidSeats: number
  /** Отозванные неиспользованные ссылки-приглашения (созданные игроком и выданные ему). */
  revokedInvites: number
  /** Игрок заблокирован в той же транзакции («Исключить и заблокировать», 21.2.24). */
  blocked: boolean
}

/**
 * Исключение игрока из группы без блокировки (21.2.21, решение владельца 2026-11-06): членство
 * переходит в `left` (вернуться можно по приглашению, как после выхода), а последствия делают
 * существующие сервисы: отмена записей (`bookingService.cancel`: места освобождаются, очередь
 * продвигается, неоплаченные места отменяются, оплаченные освобождаются без возврата, занятия
 * абонемента восстанавливаются) и отзыв запросов приглашений. С `block` (21.2.24) игрок в той же
 * транзакции блокируется через `memberService.block`, чтобы не вернуться по многоразовой ссылке. Абонемент, долг, платежи, посещения и
 * кассовые записи не трогаются. Всё в одной транзакции; аудит пишет исполнителя и причину.
 *
 * Гонка с записью: сначала под advisory-lock берутся все будущие события группы (по возрастанию id,
 * тот же ключ, что у `book`/`cancel`), только потом блокируется строка участника. Запись, начатая
 * до нас, дождётся коммита и увидит `left`; запись, закоммиченная до нашего lock, попадёт в отмену.
 */
export async function excludeMember(
  ctx: ServiceContext,
  memberId: number,
  input: ExcludeMemberInput = {},
): Promise<ExcludeMemberResult> {
  const { reason, block } = ExcludeMemberInput.parse(input)
  return inTransaction(ctx, async (tx) => {
    const db = getDb(tx)
    const now = new Date()

    const [probe] = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.id, memberId))
    if (!probe || (ctx.organization && probe.organizationId !== ctx.organization.id)) {
      throw new MemberNotFoundError(memberId)
    }
    const orgId = probe.organizationId

    const futureEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.organizationId, orgId), gt(events.startsAt, now)))
      .orderBy(asc(events.id))
    for (const { id } of futureEvents) {
      await db.execute(sql`SELECT pg_advisory_xact_lock(${id})`)
    }

    const [m] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.id, memberId))
      .for('update')
    if (!m) throw new MemberNotFoundError(memberId)

    // права проверяются по членству исполнителя в этой группе, а не по контексту запроса
    const actor = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, ctx.userId),
      ),
    })
    if (m.role === 'owner') throw new CannotExcludeOwnerError()
    if (m.userId === ctx.userId) throw new CannotExcludeSelfError()
    requireCanExclude(actor ?? null, m)
    if (!EXCLUDABLE_STATUSES.includes(m.status)) {
      throw new MemberInvalidTransitionError(m.status, 'left')
    }

    const [updated] = await db
      .update(organizationMembers)
      .set({ status: 'left', updatedAt: now })
      .where(and(eq(organizationMembers.id, memberId), eq(organizationMembers.status, m.status)))
      .returning()
    if (!updated) throw new MemberInvalidTransitionError(m.status, 'left')

    // будущие записи (в основе, в очереди, с оплатой): общий путь отмены организатором
    const open = await db
      .select({ id: bookings.id })
      .from(bookings)
      .innerJoin(events, eq(events.id, bookings.eventId))
      .where(
        and(
          eq(bookings.userId, m.userId),
          eq(bookings.organizationId, orgId),
          gt(events.startsAt, now),
          inArray(bookings.status, ['confirmed', 'pending_payment', 'waitlisted']),
        ),
      )
      .orderBy(asc(events.startsAt), asc(bookings.id))
    let paidSeats = 0
    const cancelledIds: number[] = []
    for (const { id } of open) {
      const booking = await bookingService.getById(tx, id)
      const live = await paymentService.listLive(tx, booking)
      paidSeats += live.filter((p) => p.status === 'succeeded').length
      await bookingService.cancel(tx, id, { byAdmin: true })
      cancelledIds.push(id)
    }

    // запросы приглашения на события «по приглашению» снимаются тем же путём, что отзыв игроком
    const requests = await db
      .select({ id: eventInviteRequests.id, eventId: eventInviteRequests.eventId })
      .from(eventInviteRequests)
      .innerJoin(events, eq(events.id, eventInviteRequests.eventId))
      .where(
        and(
          eq(eventInviteRequests.organizationId, orgId),
          eq(eventInviteRequests.userId, m.userId),
          eq(eventInviteRequests.status, 'pending'),
          eq(events.status, 'published'),
          gt(events.startsAt, now),
        ),
      )
    for (const r of requests) {
      await eventInviteRequestService.cancel({ ...tx, userId: m.userId }, orgId, r.eventId, r.id)
    }

    // неиспользованные ссылки: созданные игроком и выданные ему (одобренные запросы)
    const issued = await db
      .select({ inviteId: eventInviteRequests.inviteId })
      .from(eventInviteRequests)
      .where(
        and(
          eq(eventInviteRequests.organizationId, orgId),
          eq(eventInviteRequests.userId, m.userId),
          eq(eventInviteRequests.status, 'approved'),
        ),
      )
    const issuedIds = issued.flatMap((r) => (r.inviteId === null ? [] : [r.inviteId]))
    const ownedByPlayer = eq(inviteLinks.createdByUserId, m.userId)
    const revoked = await db
      .update(inviteLinks)
      .set({ isRevoked: true })
      .where(
        and(
          eq(inviteLinks.organizationId, orgId),
          eq(inviteLinks.isRevoked, false),
          or(isNull(inviteLinks.expiresAt), gt(inviteLinks.expiresAt, now)),
          sql`(${inviteLinks.maxUses} IS NULL OR ${inviteLinks.usesCount} < ${inviteLinks.maxUses})`,
          issuedIds.length > 0
            ? or(ownedByPlayer, inArray(inviteLinks.id, issuedIds))
            : ownedByPlayer,
        ),
      )
      .returning({ id: inviteLinks.id })

    await auditService.record(tx, {
      organizationId: orgId,
      action: AUDIT_ACTIONS.MEMBER_EXCLUDED,
      entityType: 'member',
      entityId: m.id,
      oldValue: { role: m.role, status: m.status },
      newValue: {
        role: updated.role,
        status: updated.status,
        reason,
        cancelledBookingIds: cancelledIds,
        paidSeats,
        revokedInviteIds: revoked.map((r) => r.id),
        blocked: block,
      },
    })

    // «Исключить и заблокировать» (21.2.24): общая логика блокировки в той же транзакции, сбой
    // откатывает и исключение. Права уже проверены requireCanExclude (строже прав модерации).
    const member = block ? await memberService.block(tx, memberId) : updated

    // уведомления уходят после коммита (collect-then-notify)
    const [org, player, managers] = await Promise.all([
      db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { name: true },
      }),
      db.query.users.findFirst({
        where: eq(users.id, m.userId),
        columns: { name: true, telegramUsername: true },
      }),
      db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, orgId),
            eq(organizationMembers.status, 'active'),
            inArray(organizationMembers.role, ['owner', 'organizer']),
          ),
        ),
    ])
    collectNotification(tx, {
      userId: m.userId,
      type: 'member_excluded',
      params: { organizationName: org?.name, cancelledBookings: cancelledIds.length },
    })
    for (const manager of managers) {
      collectNotification(tx, {
        userId: manager.userId,
        type: 'member_excluded_organizer',
        params: {
          organizationId: orgId,
          playerName: player?.name ?? player?.telegramUsername ?? undefined,
          cancelledBookings: cancelledIds.length,
          paidSeats,
        },
      })
    }

    return {
      member,
      cancelledBookings: cancelledIds.length,
      paidSeats,
      revokedInvites: revoked.length,
      blocked: block,
    }
  })
}
