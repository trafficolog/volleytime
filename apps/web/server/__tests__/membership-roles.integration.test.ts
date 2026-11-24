import { eventService, memberService, organizationService } from '@volley-time/core'
import {
  and,
  asc,
  auditLog,
  closeDb,
  db,
  eq,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type MemberBody = {
  id: number
  role: string
  roles: string[]
  canAcceptPayment: boolean
  status: string
  user: { id: number }
  leads?: { id: number }[]
}

/**
 * Task 30.1.1 (P-18): роли на членстве, тренер и флаг «Принимает оплату» — HTTP, права, IDOR,
 * журнал, режим «Играю» и роль на событии.
 */
describe('membership roles API (HTTP integration, 30.1.1)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let coachId: number
  let coach2Id: number
  let playerId: number
  let applicantId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  let coachMemberId: number
  let coach2MemberId: number
  let playerMemberId: number
  let organizerMemberId: number
  let otherMemberId: number
  let coachedEventId: number
  let otherEventId: number
  const base = (id = orgId) => `/api/organizations/${id}`
  const future = (h: number) => new Date(Date.now() + h * 3600_000)
  const mkEvent = (title: string, coachUserIds?: number[]) => ({
    title,
    startsAt: future(24),
    endsAt: future(26),
    capacity: 10,
    price: 1500,
    ...(coachUserIds ? { coachUserIds } : {}),
  })
  const patch = (memberId: number, user: number, body: unknown, id = orgId) =>
    request('PATCH', `${base(id)}/members/${memberId}`, { user, body })
  const roster = (user: number, eventId = coachedEventId, headers?: Record<string, string>) =>
    request('GET', `${base()}/events/${eventId}/bookings`, { user, headers })

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `mr-${tag}-${Math.random()}@t.by`, name: `Name ${tag}` })
      .returning()
    return u!.id
  }
  const roleAudit = (memberId: number) =>
    db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'member'), eq(auditLog.entityId, memberId)))
      .orderBy(asc(auditLog.id))
      .then((rows) => rows.filter((r) => r.action === 'member.role_changed'))

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    coachId = await newUser('coach')
    coach2Id = await newUser('coach2')
    playerId = await newUser('player')
    applicantId = await newUser('applicant')
    otherOwnerId = await newUser('other-owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Roles HTTP' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Other' })).id
    const add = async (userId: number, extra: Record<string, unknown> = {}) =>
      (await memberService.add({ userId: ownerId }, { organizationId: orgId, userId, ...extra })).id
    organizerMemberId = await add(organizerId, { role: 'organizer' })
    coachMemberId = await add(coachId, { role: 'coach' })
    coach2MemberId = await add(coach2Id, { role: 'coach' })
    playerMemberId = await add(playerId)
    await add(applicantId, { status: 'pending' })
    otherMemberId = (
      await memberService.add(
        { userId: otherOwnerId },
        { organizationId: otherOrgId, userId: coachId, role: 'coach' },
      )
    ).id
    coachedEventId = (
      await eventService.create({ userId: ownerId }, orgId, mkEvent('Тренировка', [coachId]))
    ).id
    otherEventId = (await eventService.create({ userId: ownerId }, orgId, mkEvent('Игра'))).id
    for (const user of [playerId, organizerId]) {
      const res = await request('POST', `${base()}/events/${coachedEventId}/bookings`, {
        user,
        body: { method: 'cash' },
      })
      expect(res.status).toBe(200)
    }
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('GET …/members?role=', () => {
    it('filters by membership role; coach includes the legacy assistant value', async () => {
      // строка, которую мог записать прежний runtime в окне отката (D-31)
      await db
        .update(organizationMembers)
        .set({ role: 'assistant' })
        .where(eq(organizationMembers.id, coach2MemberId))
      const coaches = await request('GET', `${base()}/members?role=coach`, { user: ownerId })
      expect(coaches.status).toBe(200)
      const rows = (coaches.body as { members: MemberBody[] }).members
      expect(rows.map((m) => m.id).sort()).toEqual([coachMemberId, coach2MemberId].sort())
      for (const m of rows) {
        expect(m.role).toBe('coach')
        expect(m.roles).toEqual(['coach', 'player'])
      }
      const players = await request('GET', `${base()}/members?role=player`, { user: ownerId })
      expect((players.body as { members: MemberBody[] }).members.map((m) => m.id)).toEqual([
        playerMemberId,
      ])
      const owners = await request('GET', `${base()}/members?role=owner`, { user: playerId })
      expect((owners.body as { members: MemberBody[] }).members.map((m) => m.user.id)).toEqual([
        ownerId,
      ])
    })

    it('shows what a coach leads to managers only', async () => {
      const manager = await request('GET', `${base()}/members?role=coach`, { user: organizerId })
      const coach = (manager.body as { members: MemberBody[] }).members.find(
        (m) => m.id === coachMemberId,
      )!
      expect(coach.leads!.map((e) => e.id)).toEqual([coachedEventId])
      for (const user of [playerId, coachId]) {
        const res = await request('GET', `${base()}/members?role=coach`, { user })
        expect(res.status).toBe(200)
        for (const m of (res.body as { members: MemberBody[] }).members) {
          expect(m).not.toHaveProperty('leads')
        }
      }
    })

    it('rejects an unknown role and refuses outsiders, applicants and anonymous users', async () => {
      for (const role of ['assistant', 'root']) {
        const res = await request('GET', `${base()}/members?role=${role}`, { user: ownerId })
        expect(res.status).toBe(422)
      }
      for (const user of [otherOwnerId, applicantId]) {
        const res = await request('GET', `${base()}/members?role=coach`, { user })
        expect(res.status).toBe(403)
      }
      expect((await request('GET', `${base()}/members?role=coach`)).status).toBe(401)
    })
  })

  describe('PATCH …/members/{memberId}', () => {
    it('owner assigns coach; the change is logged with the author', async () => {
      const res = await patch(playerMemberId, ownerId, { role: 'coach' })
      expect(res.status).toBe(200)
      expect((res.body as { member: MemberBody }).member).toMatchObject({
        role: 'coach',
        roles: ['coach', 'player'],
        canAcceptPayment: false,
      })
      const audit = await roleAudit(playerMemberId)
      expect(audit).toHaveLength(1)
      expect(audit[0]).toMatchObject({
        userId: ownerId,
        oldValue: { role: 'player', canAcceptPayment: false },
        newValue: { role: 'coach', canAcceptPayment: false },
      })
      // повтор той же роли ничего не пишет
      expect((await patch(playerMemberId, ownerId, { role: 'coach' })).status).toBe(200)
      expect(await roleAudit(playerMemberId)).toHaveLength(1)
    })

    it('organizer and owner grant and revoke the payment flag of a coach, with history', async () => {
      const granted = await patch(coachMemberId, organizerId, { canAcceptPayment: true })
      expect(granted.status).toBe(200)
      expect((granted.body as { member: MemberBody }).member.canAcceptPayment).toBe(true)
      const revoked = await patch(coachMemberId, ownerId, { canAcceptPayment: false })
      expect((revoked.body as { member: MemberBody }).member.canAcceptPayment).toBe(false)
      const audit = await roleAudit(coachMemberId)
      expect(audit.map((a) => [a.userId, a.newValue])).toEqual([
        [organizerId, { role: 'coach', canAcceptPayment: true }],
        [ownerId, { role: 'coach', canAcceptPayment: false }],
      ])
    })

    it('«Убрать из команды» keeps the person a player of the group and drops the flag', async () => {
      await patch(coachMemberId, ownerId, { canAcceptPayment: true })
      const res = await patch(coachMemberId, ownerId, { role: 'player' })
      expect(res.status).toBe(200)
      expect((res.body as { member: MemberBody }).member).toMatchObject({
        role: 'player',
        roles: ['player'],
        status: 'active',
        canAcceptPayment: false,
      })
      const [row] = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.id, coachMemberId))
      expect(row).toMatchObject({ role: 'player', status: 'active', canAcceptPayment: false })
      // назначение на событие без роли тренера прав не даёт
      expect((await roster(coachId)).status).toBe(403)
    })

    it('only the owner changes roles; coaches and players change nothing', async () => {
      expect((await patch(playerMemberId, organizerId, { role: 'coach' })).status).toBe(403)
      for (const user of [coachId, playerId]) {
        expect((await patch(coach2MemberId, user, { canAcceptPayment: true })).status).toBe(403)
        expect((await patch(playerMemberId, user, { role: 'coach' })).status).toBe(403)
      }
      expect(await roleAudit(playerMemberId)).toHaveLength(0)
      expect(await roleAudit(coach2MemberId)).toHaveLength(0)
    })

    it('the flag exists only for an active coach; owner and own roles are immutable', async () => {
      for (const id of [playerMemberId, organizerMemberId]) {
        const res = await patch(id, ownerId, { canAcceptPayment: true })
        expect(res.status).toBe(422)
        expect((res.body as { data: { code: string } }).data.code).toBe('member.not_coach')
      }
      // роль и флаг одним запросом атомарны: смена на игрока и флаг → 422, ничего не меняется
      const both = await patch(coachMemberId, ownerId, { role: 'player', canAcceptPayment: true })
      expect(both.status).toBe(422)
      const [row] = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.id, coachMemberId))
      expect(row!.role).toBe('coach')
      const [ownerRow] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.role, 'owner')),
        )
      expect((await patch(ownerRow!.id, ownerId, { role: 'player' })).status).toBe(422)
      const self = await patch(organizerMemberId, organizerId, { canAcceptPayment: true })
      expect(self.status).toBe(422)
    })

    it('validates the body', async () => {
      const bodies = [
        {},
        { role: 'owner' },
        { role: 'assistant' },
        { canAcceptPayment: 'yes' },
        { extra: 1, role: 'player' },
      ]
      for (const body of bodies) {
        expect((await patch(coachMemberId, ownerId, body)).status).toBe(422)
      }
    })

    it('IDOR: a member of another group is not found and stays unchanged', async () => {
      expect((await patch(otherMemberId, ownerId, { canAcceptPayment: true })).status).toBe(404)
      expect((await patch(otherMemberId, organizerId, { canAcceptPayment: true })).status).toBe(404)
      expect((await patch(otherMemberId, ownerId, { role: 'organizer' })).status).toBe(404)
      expect((await patch(coachMemberId, otherOwnerId, { canAcceptPayment: true })).status).toBe(
        403,
      )
      const viaOwnOrg = await patch(
        coachMemberId,
        otherOwnerId,
        { canAcceptPayment: true },
        otherOrgId,
      )
      expect(viaOwnOrg.status).toBe(404)
      const rows = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, coachId))
      expect(rows.every((r) => !r.canAcceptPayment && r.role === 'coach')).toBe(true)
    })
  })

  describe('GET /api/me/memberships', () => {
    it('returns roles and modes for my active memberships only', async () => {
      await memberService.add(
        { userId: otherOwnerId },
        { organizationId: otherOrgId, userId: applicantId, status: 'pending' },
      )
      await patch(coachMemberId, ownerId, { canAcceptPayment: true })
      const coach = await request('GET', '/api/me/memberships', { user: coachId })
      expect(coach.status).toBe(200)
      const rows = (coach.body as { memberships: Record<string, unknown>[] }).memberships
      expect(rows).toHaveLength(2)
      expect(rows.find((m) => m.organizationId === orgId)).toMatchObject({
        role: 'coach',
        roles: ['coach', 'player'],
        canAcceptPayment: true,
        modes: ['play', 'coach'],
      })
      expect(rows.find((m) => m.organizationId === otherOrgId)).toMatchObject({
        role: 'coach',
        canAcceptPayment: false,
      })

      const expected: [number, string[], string[]][] = [
        [ownerId, ['owner', 'player'], ['play', 'manage']],
        [organizerId, ['organizer', 'player'], ['play', 'manage']],
        [playerId, ['player'], ['play']],
      ]
      for (const [user, roles, modes] of expected) {
        const res = await request('GET', '/api/me/memberships', { user })
        const list = (res.body as { memberships: Record<string, unknown>[] }).memberships
        expect(list).toHaveLength(1)
        expect(list[0]).toMatchObject({
          organizationId: orgId,
          roles,
          modes,
          canAcceptPayment: false,
        })
      }
      // заявка — не членство
      const applicant = await request('GET', '/api/me/memberships', { user: applicantId })
      expect((applicant.body as { memberships: unknown[] }).memberships).toEqual([])
      expect((await request('GET', '/api/me/memberships')).status).toBe(401)
    })
  })

  describe('event roster: group role ∪ event role', () => {
    const PAYMENT_FIELDS = [
      'method',
      'paymentId',
      'pendingPaymentIds',
      'paidSeats',
      'allocatedAmount',
      'subscriptionId',
      'confirmedAt',
      'offer',
    ]

    it('a coach without the flag sees the roster of their event without payment data', async () => {
      const res = await roster(coachId)
      expect(res.status).toBe(200)
      const bookings = (res.body as { bookings: Record<string, unknown>[] }).bookings
      expect(bookings).toHaveLength(2)
      for (const b of bookings) {
        for (const f of PAYMENT_FIELDS) expect(b).not.toHaveProperty(f)
        expect(b.status).not.toBe('pending_payment')
      }
      expect(res.text).not.toMatch(/1500|pending_payment|cash/)
    })

    it('a coach with the flag sees payments of their own events only', async () => {
      await patch(coachMemberId, ownerId, { canAcceptPayment: true })
      const own = await roster(coachId)
      expect(own.status).toBe(200)
      expect(own.body).toEqual((await roster(ownerId)).body)
      expect((await roster(coachId, otherEventId)).status).toBe(403)
    })

    it('an unassigned coach, a player and an outsider are refused', async () => {
      for (const user of [coach2Id, playerId, otherOwnerId]) {
        expect((await roster(user)).status).toBe(403)
      }
    })

    it('IDOR: an event of another group is not found', async () => {
      const foreign = (
        await eventService.create({ userId: otherOwnerId }, otherOrgId, mkEvent('Чужое'))
      ).id
      expect((await roster(ownerId, foreign)).status).toBe(404)
      expect((await roster(coachId, foreign)).status).toBe(404)
    })

    it('in play mode an organizer and a coach get the same answers as a plain player', async () => {
      const play = { 'x-vt-mode': 'play' }
      expect((await roster(organizerId, coachedEventId, play)).status).toBe(403)
      expect((await roster(coachId, coachedEventId, play)).status).toBe(403)
      const asPlayer = await request('GET', `${base()}/members`, { user: playerId })
      for (const user of [organizerId, coachId]) {
        const res = await request('GET', `${base()}/members`, { user, headers: play })
        expect(res.status).toBe(200)
        expect(res.body).toEqual(asPlayer.body)
        const balance = await request('GET', `${base()}/event-balance`, { user, headers: play })
        expect(balance.status).toBe(403)
      }
      // без заголовка организатор — снова управляющий
      expect((await roster(organizerId)).status).toBe(200)
    })
  })

  describe('event coaches', () => {
    it('only active coaches and managers of the group can be assigned', async () => {
      const bad = [[playerId], [applicantId], [otherOwnerId], [coachId, coachId]]
      for (const coachUserIds of bad) {
        const res = await request('POST', `${base()}/events`, {
          user: ownerId,
          body: { ...mkEvent('Плохие'), coachUserIds },
        })
        expect(res.status).toBe(422)
      }
      const ok = await request('PATCH', `${base()}/events/${otherEventId}`, {
        user: organizerId,
        body: { coachUserIds: [coach2Id, organizerId] },
      })
      expect(ok.status).toBe(200)
      expect((await roster(coach2Id, otherEventId)).status).toBe(200)
    })

    it('a coach cannot create or move events', async () => {
      const created = await request('POST', `${base()}/events`, {
        user: coachId,
        body: mkEvent('Сам'),
      })
      expect(created.status).toBe(403)
      const moved = await request('PATCH', `${base()}/events/${coachedEventId}`, {
        user: coachId,
        body: { startsAt: future(48).toISOString(), endsAt: future(50).toISOString() },
      })
      expect(moved.status).toBe(403)
    })
  })
})
