import {
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  eventInviteRequests,
  events,
  inviteLinks,
  organizationMembers,
  organizations,
  payments,
  and,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AUDIT_ACTIONS } from '../audit/actions'
import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { eventInviteRequestService, eventInviteService } from '../invites/event-invites'
import { inviteService } from '../invites/service'
import type { PendingNotification } from '../notifier/types'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'
import { planService } from '../subscription-plans/service'
import { subscriptionService } from '../subscriptions/service'

import { excludeMember } from './exclude'
import { memberService } from './service'

/**
 * Task 21.2.21 (решение владельца 2026-11-06): исключение игрока без блокировки. Будущие записи
 * отменяются общим путём `bookingService.cancel`, абонемент/долг/платежи остаются, ссылки
 * отзываются, вернуться можно по приглашению; владельца и себя исключить нельзя, администраторов
 * исключает только владелец.
 */
describe('excludeMember (21.2.21, PostgreSQL)', () => {
  let ownerId: number
  let orgId: number
  const owner = () => ({ userId: ownerId })
  const future = (h = 24) => new Date(Date.now() + h * 3600_000)

  async function newUser(name = 'Игрок') {
    const [u] = await db
      .insert(users)
      .values({ email: `ex-${Math.random()}@t.by`, name })
      .returning()
    return u!.id
  }
  async function member(role: 'organizer' | 'assistant' | 'player' = 'player') {
    const userId = await newUser(role)
    const m = await memberService.add(owner(), { organizationId: orgId, userId, role })
    return { userId, memberId: m.id }
  }
  const makeEvent = (
    over: { capacity?: number; price?: number; joinMode?: 'open' | 'invite' } = {},
  ) =>
    eventService.create(owner(), orgId, {
      title: 'Игра',
      startsAt: future(),
      endsAt: future(26),
      capacity: over.capacity ?? 10,
      price: over.price ?? 0,
      ...(over.joinMode ? { joinMode: over.joinMode } : {}),
    })
  const booking = (id: number) =>
    db.query.bookings.findFirst({ where: eq(bookings.id, id) }).then((b) => b!)
  const memberRow = (id: number) =>
    db.query.organizationMembers
      .findFirst({ where: eq(organizationMembers.id, id) })
      .then((m) => m!)
  const exclude = (memberId: number, actor = ownerId, input: { reason?: string } = {}) =>
    excludeMember({ userId: actor }, memberId, input)

  beforeEach(async () => {
    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
    vi.stubEnv('EVENT_INVITE_MODE_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('Организатор')
    orgId = (await organizationService.create(owner(), { name: 'Исключения' })).id
    await db.update(organizations).set({ maxSeatsPerBooking: 5 }).where(eq(organizations.id, orgId))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })
  afterAll(async () => {
    await closeDb()
  })

  it('cancels future bookings (free, paid, multi-seat, queue), keeps past ones and history', async () => {
    const p = await member()
    const other = await member()
    const free = await makeEvent()
    const paid = await makeEvent({ price: 1500 })
    const multi = await makeEvent({ capacity: 3, price: 1000 })
    const queued = await makeEvent({ capacity: 1 })

    const bFree = await bookingService.book({ userId: p.userId }, orgId, free.id, {
      method: 'free',
    })
    const bPaid = await bookingService.book({ userId: p.userId }, orgId, paid.id, {
      method: 'cash',
    })
    await paymentService.confirm(owner(), bPaid.paymentId!, { orgId })
    const bMulti = await bookingService.book({ userId: p.userId }, orgId, multi.id, {
      method: 'cash',
      seats: 2,
    })
    await paymentService.confirm(owner(), bMulti.paymentId!, { orgId })
    // событие на одно место: занято другим игроком, p стоит в очереди
    await bookingService.book({ userId: other.userId }, orgId, queued.id, { method: 'free' })
    const bQueued = await bookingService.book({ userId: p.userId }, orgId, queued.id, {
      method: 'free',
    })
    expect(bQueued.status).toBe('waitlisted')
    // другой игрок в очереди за p на мульти-событие: освободившееся место получит он
    const third = await member()
    await bookingService.book({ userId: other.userId }, orgId, multi.id, { method: 'cash' })
    const bThird = await bookingService.book({ userId: third.userId }, orgId, multi.id, {
      method: 'cash',
      seats: 1,
      allowWaitlist: true,
    })
    expect(bThird.status).toBe('waitlisted')
    // прошедшее событие с посещением: история не меняется
    const [past] = await db
      .insert(events)
      .values({
        organizationId: orgId,
        createdByUserId: ownerId,
        title: 'Было',
        startsAt: new Date(Date.now() - 48 * 3600_000),
        endsAt: new Date(Date.now() - 46 * 3600_000),
        capacity: 10,
        status: 'published',
      })
      .returning()
    const [bPast] = await db
      .insert(bookings)
      .values({
        eventId: past!.id,
        userId: p.userId,
        organizationId: orgId,
        status: 'attended',
        method: 'free',
      })
      .returning()

    const notifications: PendingNotification[] = []
    const result = await excludeMember({ ...owner(), notifications }, p.memberId, {
      reason: 'Нарушение правил',
    })

    expect(result).toMatchObject({ cancelledBookings: 4, paidSeats: 3, revokedInvites: 0 })
    expect(result.member).toMatchObject({ status: 'left', role: 'player' })
    for (const b of [bFree, bPaid, bMulti, bQueued]) {
      expect(await booking(b.id)).toMatchObject({ status: 'cancelled', waitlistSeats: 0 })
    }
    expect(await booking(bPast!.id)).toMatchObject({ status: 'attended' })
    // платежи не удалены: оплаченные места освобождены без возврата (D-14)
    const paidPayments = await db.select().from(payments).where(eq(payments.bookingId, bPaid.id))
    expect(paidPayments).toHaveLength(1)
    expect(paidPayments[0]).toMatchObject({ status: 'succeeded' })
    expect(paidPayments[0]!.seatReleasedAt).not.toBeNull()
    const multiPayments = await db.select().from(payments).where(eq(payments.bookingId, bMulti.id))
    expect(multiPayments.map((x) => x.status)).toEqual(['succeeded', 'succeeded'])
    expect(multiPayments.every((x) => x.seatReleasedAt !== null)).toBe(true)
    // очередь продвинута: место получил следующий (в основе, ждёт оплаты)
    expect(await booking(bThird.id)).toMatchObject({ status: 'pending_payment' })
    // кассовые записи на месте
    expect((await db.select().from(payments).where(eq(payments.userId, p.userId))).length).toBe(3)

    // уведомления: игроку и управляющим; продвинутый из очереди — по общим правилам
    const byType = (t: string) => notifications.filter((n) => n.type === t)
    expect(byType('member_excluded')).toEqual([
      expect.objectContaining({
        userId: p.userId,
        params: expect.objectContaining({ cancelledBookings: 4 }),
      }),
    ])
    expect(byType('member_excluded_organizer').map((n) => n.userId)).toEqual([ownerId])
    expect(byType('member_excluded_organizer')[0]!.params).toMatchObject({
      cancelledBookings: 4,
      paidSeats: 3,
    })
    expect(byType('waitlist_promoted').some((n) => n.userId === third.userId)).toBe(true)
  })

  it('frees the seat for a stranger who tries to book right after', async () => {
    const p = await member()
    const other = await member()
    const ev = await makeEvent({ capacity: 1 })
    await bookingService.book({ userId: p.userId }, orgId, ev.id, { method: 'free' })
    await exclude(p.memberId)
    const b = await bookingService.book({ userId: other.userId }, orgId, ev.id, { method: 'free' })
    expect(b.status).toBe('confirmed')
    // исключённый больше не может записаться
    await expect(
      bookingService.book({ userId: p.userId }, orgId, ev.id, { method: 'free' }),
    ).rejects.toMatchObject({ code: 'booking.event_not_bookable' })
  })

  it('keeps the active subscription (sessions of cancelled bookings return) and it works after rejoining', async () => {
    const p = await member()
    const ev = await makeEvent({ price: 1500 })
    const plan = await planService.create(owner(), {
      organizationId: orgId,
      name: 'Абонемент',
      totalSessions: 4,
    })
    const sub = await subscriptionService.createFromPlan({ userId: p.userId }, orgId, plan.id, {
      autoActivate: true,
    })
    await bookingService.book({ userId: p.userId }, orgId, ev.id, {
      method: 'subscription',
      seats: 2,
    })
    expect((await subscriptionService.getById(owner(), sub.id)).usedSessions).toBe(2)

    await exclude(p.memberId)

    const kept = await subscriptionService.getById(owner(), sub.id)
    expect(kept).toMatchObject({
      userId: p.userId,
      status: 'active',
      totalSessions: 4,
      usedSessions: 0,
    })

    // возвращение по приглашению: абонемент снова работает
    const invite = await inviteService.create(owner(), { organizationId: orgId })
    await inviteService.redeem({ userId: p.userId }, invite.token)
    const again = await makeEvent({ price: 1500 })
    const b = await bookingService.book({ userId: p.userId }, orgId, again.id, {
      method: 'subscription',
    })
    expect(b).toMatchObject({ status: 'confirmed', subscriptionId: sub.id })
    expect((await subscriptionService.getById(owner(), sub.id)).usedSessions).toBe(1)
  })

  it('keeps debt and pending payments; nothing is written off', async () => {
    const p = await member()
    // долг: неоплаченное место прошедшего события и неоплаченный абонемент
    const [past] = await db
      .insert(events)
      .values({
        organizationId: orgId,
        createdByUserId: ownerId,
        title: 'Было',
        startsAt: new Date(Date.now() - 48 * 3600_000),
        endsAt: new Date(Date.now() - 46 * 3600_000),
        capacity: 10,
        status: 'published',
        price: 1500,
      })
      .returning()
    const [pastBooking] = await db
      .insert(bookings)
      .values({
        eventId: past!.id,
        userId: p.userId,
        organizationId: orgId,
        status: 'attended',
        method: 'cash',
      })
      .returning()
    await db.insert(payments).values({
      organizationId: orgId,
      userId: p.userId,
      bookingId: pastBooking!.id,
      bookingIncarnation: pastBooking!.incarnation,
      amount: 1500,
      method: 'cash',
      status: 'pending',
    })
    const plan = await planService.create(owner(), {
      organizationId: orgId,
      name: 'Платный',
      totalSessions: 4,
      price: 4000,
    })
    const { paymentId: subPaymentId } = await subscriptionService.purchase(
      { userId: p.userId },
      orgId,
      plan.id,
      { method: 'cash' },
    )
    const pendingBefore = (await paymentService.listPending(owner(), orgId)).length

    await exclude(p.memberId)

    const rows = await db.select().from(payments).where(eq(payments.userId, p.userId))
    expect(rows.map((r) => r.status).sort()).toEqual(['pending', 'pending'])
    expect(rows.every((r) => r.seatReleasedAt === null)).toBe(true)
    expect((await paymentService.listPending(owner(), orgId)).length).toBe(pendingBefore)
    // организатор подтверждает как обычно
    await paymentService.confirm(owner(), subPaymentId!, { orgId })
  })

  it('does not block: the excluded player rejoins by invite with the same membership row', async () => {
    const p = await member()
    await exclude(p.memberId)
    expect(await memberRow(p.memberId)).toMatchObject({ status: 'left' })
    expect(await memberRow(p.memberId)).not.toMatchObject({ status: 'blocked' })

    const invite = await inviteService.create(owner(), { organizationId: orgId })
    const rejoined = await inviteService.redeem({ userId: p.userId }, invite.token)
    expect(rejoined).toMatchObject({ id: p.memberId, status: 'active', role: 'player' })
    const actions = (
      await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
    ).map((a) => a.action)
    expect(actions).toContain(AUDIT_ACTIONS.MEMBER_EXCLUDED)
    expect(actions).toContain(AUDIT_ACTIONS.MEMBER_REJOINED)
  })

  it('a blocked player stays blocked and cannot be "excluded" into a rejoinable state', async () => {
    const p = await member()
    await memberService.block(owner(), p.memberId)
    await expect(exclude(p.memberId)).rejects.toMatchObject({ code: 'member.invalid_transition' })
    expect(await memberRow(p.memberId)).toMatchObject({ status: 'blocked' })
    await exclude((await member()).memberId)
    // повторное исключение уже вышедшего
    const q = await member()
    await exclude(q.memberId)
    await expect(exclude(q.memberId)).rejects.toMatchObject({ code: 'member.invalid_transition' })
  })

  it('forbids excluding the owner and yourself; unknown member is 404', async () => {
    const ownerMember = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.userId, ownerId),
    })
    const org = await member('organizer')
    await expect(exclude(ownerMember!.id, ownerId)).rejects.toMatchObject({
      code: 'member.cannot_exclude_owner',
    })
    await expect(exclude(ownerMember!.id, org.userId)).rejects.toMatchObject({
      code: 'member.cannot_exclude_owner',
    })
    await expect(exclude(org.memberId, org.userId)).rejects.toMatchObject({
      code: 'member.cannot_exclude_self',
    })
    await expect(exclude(999_999)).rejects.toMatchObject({ code: 'member.not_found' })
    expect(await memberRow(ownerMember!.id)).toMatchObject({ status: 'active' })
    expect(await memberRow(org.memberId)).toMatchObject({ status: 'active' })
  })

  it('admins (organizer, assistant) are excluded only by the owner; organizer excludes players', async () => {
    const organizer = await member('organizer')
    const assistant = await member('assistant')
    const p1 = await member()
    const p2 = await member()
    const plain = await member()

    await expect(exclude(assistant.memberId, organizer.userId)).rejects.toMatchObject({
      code: 'forbidden.exclude',
    })
    const org2 = await member('organizer')
    await expect(exclude(org2.memberId, organizer.userId)).rejects.toMatchObject({
      code: 'forbidden.exclude',
    })
    await expect(exclude(p1.memberId, plain.userId)).rejects.toMatchObject({
      code: 'forbidden.exclude',
    })
    await expect(exclude(p1.memberId, assistant.userId)).rejects.toMatchObject({
      code: 'forbidden.exclude',
    })
    // никто из отказанных не затронут
    for (const m of [assistant, org2, p1])
      expect(await memberRow(m.memberId)).toMatchObject({ status: 'active' })

    await exclude(p1.memberId, organizer.userId)
    await exclude(assistant.memberId, ownerId)
    await exclude(org2.memberId, ownerId)
    expect(await memberRow(p1.memberId)).toMatchObject({ status: 'left' })
    expect(await memberRow(assistant.memberId)).toMatchObject({ status: 'left' })
    expect(await memberRow(p2.memberId)).toMatchObject({ status: 'active' })
  })

  it('IDOR: a manager of another group cannot exclude; the service scopes by organization context', async () => {
    const p = await member()
    const otherOwner = await newUser('Чужой')
    const otherOrg = await organizationService.create({ userId: otherOwner }, { name: 'Чужая' })
    // менеджер чужой группы: в этой группе его членства нет → отказ, участник не тронут
    await expect(exclude(p.memberId, otherOwner)).rejects.toMatchObject({
      code: 'forbidden.exclude',
    })
    // контекст запроса чужой группы: участник «не найден»
    await expect(
      excludeMember({ userId: otherOwner, organization: otherOrg }, p.memberId),
    ).rejects.toMatchObject({ code: 'member.not_found' })
    expect(await memberRow(p.memberId)).toMatchObject({ status: 'active' })
  })

  it('revokes unused invite links (created by the player and issued to them), records actor and reason', async () => {
    const organizer = await member('organizer')
    const p = await member()
    // ссылка, созданная исключаемым организатором (исключает владелец), и ссылка владельца остаётся
    const byOrganizer = await inviteService.create(
      { userId: organizer.userId },
      { organizationId: orgId },
    )
    const byOwner = await inviteService.create(owner(), { organizationId: orgId })
    // личная ссылка на событие «по приглашению», выданная игроку по запросу
    const ev = await makeEvent({ joinMode: 'invite' })
    const request = await eventInviteRequestService.request({ userId: p.userId }, orgId, ev.id, {})
    const decided = await eventInviteRequestService.approve(owner(), orgId, ev.id, request.id)
    const issuedInvite = await db.query.inviteLinks.findFirst({
      where: eq(inviteLinks.id, decided.inviteId!),
    })
    expect(issuedInvite!.isRevoked).toBe(false)
    // второй запрос на другое событие ещё ожидает ответа
    const ev2 = await makeEvent({ joinMode: 'invite' })
    const pending = await eventInviteRequestService.request({ userId: p.userId }, orgId, ev2.id, {})

    const r1 = await exclude(organizer.memberId, ownerId, { reason: '  Не ходит  ' })
    expect(r1.revokedInvites).toBe(1)
    const r2 = await exclude(p.memberId, ownerId, { reason: 'Переехал' })
    expect(r2.revokedInvites).toBe(1)

    const link = (id: number) =>
      db.query.inviteLinks.findFirst({ where: eq(inviteLinks.id, id) }).then((i) => i!)
    expect((await link(byOrganizer.id)).isRevoked).toBe(true)
    expect((await link(byOwner.id)).isRevoked).toBe(false)
    expect((await link(decided.inviteId!)).isRevoked).toBe(true)
    const pendingRow = await db.query.eventInviteRequests.findFirst({
      where: eq(eventInviteRequests.id, pending.id),
    })
    expect(pendingRow!.status).toBe('cancelled')
    // ссылка группы перестаёт работать у исключённого организатора, владельца — нет
    await expect(
      inviteService.redeem({ userId: await newUser() }, byOrganizer.token),
    ).rejects.toMatchObject({
      code: 'invite.revoked',
    })

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.action, AUDIT_ACTIONS.MEMBER_EXCLUDED), eq(auditLog.entityId, p.memberId)),
      )
    expect(entry).toMatchObject({ userId: ownerId, organizationId: orgId, entityType: 'member' })
    expect(entry!.newValue).toMatchObject({ status: 'left', reason: 'Переехал' })
    const [orgEntry] = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, AUDIT_ACTIONS.MEMBER_EXCLUDED),
          eq(auditLog.entityId, organizer.memberId),
        ),
      )
    expect(orgEntry!.newValue).toMatchObject({ reason: 'Не ходит' })
    void eventInviteService
  })

  it('is atomic: a failure after the status change rolls everything back', async () => {
    const p = await member()
    const ev = await makeEvent()
    const b = await bookingService.book({ userId: p.userId }, orgId, ev.id, { method: 'free' })
    await expect(
      excludeMember({ userId: ownerId }, p.memberId, { reason: 'x'.repeat(501) }),
    ).rejects.toBeTruthy()
    expect(await memberRow(p.memberId)).toMatchObject({ status: 'active' })
    expect(await booking(b.id)).toMatchObject({ status: 'confirmed' })
  })

  it('race: a concurrent booking never survives the exclusion', async () => {
    const p = await member()
    const fillers = await Promise.all([member(), member()])
    for (let i = 0; i < 8; i++) {
      const ev = await makeEvent({ capacity: 2 })
      const settled = await Promise.allSettled([
        excludeMember({ userId: ownerId }, p.memberId, {}),
        bookingService.book({ userId: p.userId }, orgId, ev.id, { method: 'free' }),
        bookingService.book({ userId: fillers[i % 2]!.userId }, orgId, ev.id, { method: 'free' }),
      ])
      expect(settled[0]!.status).toBe('fulfilled')
      const live = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.userId, p.userId), eq(bookings.eventId, ev.id)))
      // либо записи не было (отказ «не участник»), либо она отменена исключением
      expect(live.every((b) => b.status === 'cancelled')).toBe(true)
      // состав мест цел: у события не больше вместимости занятых мест
      const taken = (await db.select().from(bookings).where(eq(bookings.eventId, ev.id))).filter(
        (b) => b.status === 'confirmed' || b.status === 'pending_payment',
      )
      expect(taken.reduce((s, b) => s + b.seats, 0)).toBeLessThanOrEqual(2)
      // вернуть игрока для следующей итерации
      const invite = await inviteService.create(owner(), { organizationId: orgId })
      await inviteService.redeem({ userId: p.userId }, invite.token)
    }
  })

  it('race: two concurrent exclusions give exactly one winner', async () => {
    const p = await member()
    const ev = await makeEvent()
    await bookingService.book({ userId: p.userId }, orgId, ev.id, { method: 'free' })
    const results = await Promise.allSettled([exclude(p.memberId), exclude(p.memberId)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(failed.reason).toMatchObject({ code: 'member.invalid_transition' })
  })
})
