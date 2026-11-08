import {
  and,
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AUDIT_ACTIONS } from '../audit/actions'
import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { inviteService } from '../invites/service'
import { organizationService } from '../organizations/service'

import { excludeMember } from './exclude'
import { listExcludedMembers } from './excluded'
import { memberService } from './service'

/**
 * Task 21.2.24: исключённые игроки без миграции (признак — последняя запись аудита), блокировка из
 * статуса `left`, «Исключить и заблокировать» атомарно, права как у 21.2.21.
 */
describe('excluded players (21.2.24, PostgreSQL)', () => {
  let ownerId: number
  let orgId: number
  const owner = () => ({ userId: ownerId })
  const future = (h = 24) => new Date(Date.now() + h * 3600_000)

  async function newUser(name = 'Игрок') {
    const [u] = await db
      .insert(users)
      .values({ email: `exl-${Math.random()}@t.by`, name })
      .returning()
    return u!.id
  }
  async function member(role: 'organizer' | 'assistant' | 'player' = 'player') {
    const userId = await newUser(role)
    const m = await memberService.add(owner(), { organizationId: orgId, userId, role })
    return { userId, memberId: m.id }
  }
  const memberRow = (id: number) =>
    db.query.organizationMembers
      .findFirst({ where: eq(organizationMembers.id, id) })
      .then((m) => m!)
  const auditActions = async (entityId: number) =>
    (
      await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entityType, 'member'), eq(auditLog.entityId, entityId)))
    ).map((a) => a.action)
  const excludedIds = async () =>
    (await listExcludedMembers(owner(), orgId)).map((m) => m.id).sort((a, b) => a - b)

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('Организатор')
    orgId = (await organizationService.create(owner(), { name: 'Исключённые' })).id
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  afterAll(async () => {
    await closeDb()
  })

  it('lists only excluded players, with who, when and why; voluntary leavers are not included', async () => {
    const excluded = await member()
    const leaver = await member()
    const active = await member()
    await excludeMember(owner(), excluded.memberId, { reason: 'Не платит' })
    await memberService.leaveOrg({ userId: leaver.userId }, orgId)

    const list = await listExcludedMembers(owner(), orgId)
    expect(list.map((m) => m.id)).toEqual([excluded.memberId])
    expect(list[0]).toMatchObject({
      status: 'left',
      reason: 'Не платит',
      excludedBy: { id: ownerId },
    })
    expect(list[0]!.excludedAt).toBeInstanceOf(Date)
    expect(list.map((m) => m.id)).not.toContain(leaver.memberId)
    expect(list.map((m) => m.id)).not.toContain(active.memberId)
    // статусы и данные добровольно вышедшего не затронуты
    expect((await memberRow(leaver.memberId)).status).toBe('left')
  })

  it('uses the latest transition: rejoined then left voluntarily is not excluded, and vice versa', async () => {
    const a = await member()
    await excludeMember(owner(), a.memberId)
    const invite = await inviteService.create(owner(), { organizationId: orgId })
    await inviteService.redeem({ userId: a.userId }, invite.token)
    expect(await excludedIds()).toEqual([])
    await memberService.leaveOrg({ userId: a.userId }, orgId)
    expect(await excludedIds()).toEqual([])
    await inviteService.redeem({ userId: a.userId }, invite.token)
    await excludeMember(owner(), a.memberId)
    expect(await excludedIds()).toEqual([a.memberId])
  })

  it('does not leak other groups: the list is scoped to the organization', async () => {
    const mine = await member()
    await excludeMember(owner(), mine.memberId)
    const otherOwner = await newUser('Другой')
    const otherOrg = await organizationService.create({ userId: otherOwner }, { name: 'Чужая' })
    expect(await listExcludedMembers({ userId: otherOwner }, otherOrg.id)).toEqual([])
  })

  it('blocks from left (voluntary and excluded); a repeated block is idempotent', async () => {
    const excluded = await member()
    const leaver = await member()
    await excludeMember(owner(), excluded.memberId)
    await memberService.leaveOrg({ userId: leaver.userId }, orgId)

    expect((await memberService.block(owner(), excluded.memberId)).status).toBe('blocked')
    expect((await memberService.block(owner(), leaver.memberId)).status).toBe('blocked')
    const again = await memberService.block(owner(), excluded.memberId)
    expect(again.status).toBe('blocked')
    const blockedAudits = (await auditActions(excluded.memberId)).filter(
      (a) => a === AUDIT_ACTIONS.MEMBER_BLOCKED,
    )
    expect(blockedAudits).toHaveLength(1)
    // заблокированный уже не в списке исключённых и может быть разблокирован как обычно
    expect(await excludedIds()).toEqual([])
    expect((await memberService.unblock(owner(), excluded.memberId)).status).toBe('active')
  })

  it('a player blocked after exclusion cannot return by a reusable invite link', async () => {
    const p = await member()
    const invite = await inviteService.create(owner(), { organizationId: orgId })
    await excludeMember(owner(), p.memberId)
    await memberService.block(owner(), p.memberId)
    await expect(inviteService.redeem({ userId: p.userId }, invite.token)).rejects.toMatchObject({
      code: 'member.blocked',
    })
    expect((await memberRow(p.memberId)).status).toBe('blocked')
  })

  it('exclude + block: one call, status blocked, bookings cancelled, both audits with the actor', async () => {
    const p = await member()
    const event = await eventService.create(owner(), orgId, {
      title: 'Игра',
      startsAt: future(),
      endsAt: future(26),
      capacity: 10,
      price: 0,
    })
    const b = await bookingService.book({ userId: p.userId }, orgId, event.id, { method: 'free' })
    const invite = await inviteService.create(owner(), { organizationId: orgId })

    const result = await excludeMember(owner(), p.memberId, { reason: 'Спор', block: true })
    expect(result).toMatchObject({
      blocked: true,
      cancelledBookings: 1,
      member: { status: 'blocked' },
    })
    expect((await memberRow(p.memberId)).status).toBe('blocked')
    expect((await db.query.bookings.findFirst({ where: eq(bookings.id, b.id) }))!.status).toBe(
      'cancelled',
    )
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'member'), eq(auditLog.entityId, p.memberId)))
    const excludedAudit = rows.find((r) => r.action === AUDIT_ACTIONS.MEMBER_EXCLUDED)
    const blockedAudit = rows.find((r) => r.action === AUDIT_ACTIONS.MEMBER_BLOCKED)
    expect(excludedAudit).toMatchObject({ userId: ownerId, organizationId: orgId })
    expect(excludedAudit!.newValue).toMatchObject({ reason: 'Спор', blocked: true })
    expect(blockedAudit).toMatchObject({ userId: ownerId, organizationId: orgId })
    expect(blockedAudit!.oldValue).toMatchObject({ status: 'left' })
    await expect(inviteService.redeem({ userId: p.userId }, invite.token)).rejects.toMatchObject({
      code: 'member.blocked',
    })
  })

  it('exclude without block keeps the player rejoinable (21.2.21 semantics unchanged)', async () => {
    const p = await member()
    const result = await excludeMember(owner(), p.memberId, { block: false })
    expect(result).toMatchObject({ blocked: false, member: { status: 'left' } })
    expect(await auditActions(p.memberId)).not.toContain(AUDIT_ACTIONS.MEMBER_BLOCKED)
  })

  it('exclude + block is atomic: a failing block step rolls back the exclusion', async () => {
    const p = await member()
    const event = await eventService.create(owner(), orgId, {
      title: 'Игра',
      startsAt: future(),
      endsAt: future(26),
      capacity: 10,
      price: 0,
    })
    const b = await bookingService.book({ userId: p.userId }, orgId, event.id, { method: 'free' })
    vi.spyOn(memberService, 'block').mockRejectedValueOnce(new Error('block failed'))

    await expect(excludeMember(owner(), p.memberId, { block: true })).rejects.toThrow(
      'block failed',
    )
    expect((await memberRow(p.memberId)).status).toBe('active')
    expect((await db.query.bookings.findFirst({ where: eq(bookings.id, b.id) }))!.status).toBe(
      'confirmed',
    )
    expect(await auditActions(p.memberId)).not.toContain(AUDIT_ACTIONS.MEMBER_EXCLUDED)
    expect(await excludedIds()).toEqual([])
  })

  it('permissions: only the owner excludes+blocks admins; an organizer cannot; nothing changes', async () => {
    const organizer = await member('organizer')
    const organizer2 = await member('organizer')
    const assistant = await member('assistant')
    const player = await member()

    for (const target of [organizer2, assistant]) {
      await expect(
        excludeMember({ userId: organizer.userId }, target.memberId, { block: true }),
      ).rejects.toMatchObject({ code: 'forbidden.exclude' })
      expect((await memberRow(target.memberId)).status).toBe('active')
    }
    // организатор исключает и блокирует игрока
    const res = await excludeMember({ userId: organizer.userId }, player.memberId, { block: true })
    expect(res.member.status).toBe('blocked')
    // владелец — организатора
    const byOwner = await excludeMember(owner(), organizer2.memberId, { block: true })
    expect(byOwner.member.status).toBe('blocked')
    // владельца и себя нельзя
    const ownerMember = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.userId, ownerId),
    })
    await expect(
      excludeMember({ userId: organizer.userId }, ownerMember!.id, { block: true }),
    ).rejects.toMatchObject({ code: 'member.cannot_exclude_owner' })
    await expect(
      excludeMember({ userId: organizer.userId }, organizer.memberId, { block: true }),
    ).rejects.toMatchObject({ code: 'member.cannot_exclude_self' })
  })

  it('a foreign-group member id is not found when the context is scoped to another group', async () => {
    const p = await member()
    const otherOwner = await newUser('Другой')
    const otherOrg = await organizationService.create({ userId: otherOwner }, { name: 'Чужая' })
    await expect(
      excludeMember({ userId: otherOwner, organization: otherOrg }, p.memberId, { block: true }),
    ).rejects.toMatchObject({ code: 'member.not_found' })
    expect((await memberRow(p.memberId)).status).toBe('active')
  })
})
