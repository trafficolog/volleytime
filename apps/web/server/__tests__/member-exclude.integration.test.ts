import { memberService, organizationService } from '@volley-time/core'
import { and, auditLog, closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/** Task 21.2.21: исключение игрока из группы без блокировки (HTTP, права, IDOR, audit). */
describe('member exclude API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let assistantId: number
  let playerId: number
  let otherPlayerId: number
  let outsiderId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  let organizerMemberId: number
  let assistantMemberId: number
  let playerMemberId: number
  let otherPlayerMemberId: number
  let ownerMemberId: number
  let otherMemberId: number
  const url = (memberId: number, id = orgId) =>
    `/api/organizations/${id}/members/${memberId}/exclude`
  const statusOf = async (memberId: number) => {
    const res = await request('GET', `/api/organizations/${orgId}/members?statuses=active,left,blocked`, {
      user: ownerId,
    })
    return (res.body as { members: { id: number; status: string }[] }).members.find(
      (m) => m.id === memberId,
    )?.status
  }

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `ex-${tag}-${Math.random()}@t.by` })
      .returning()
    return u!.id
  }

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    assistantId = await newUser('assistant')
    playerId = await newUser('player')
    otherPlayerId = await newUser('player2')
    outsiderId = await newUser('outsider')
    otherOwnerId = await newUser('other-owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Exclude HTTP' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Other' })).id
    const add = (userId: number, role: 'organizer' | 'assistant' | 'player') =>
      memberService.add({ userId: ownerId }, { organizationId: orgId, userId, role })
    organizerMemberId = (await add(organizerId, 'organizer')).id
    assistantMemberId = (await add(assistantId, 'assistant')).id
    playerMemberId = (await add(playerId, 'player')).id
    otherPlayerMemberId = (await add(otherPlayerId, 'player')).id
    ownerMemberId = (await memberService.list({ userId: ownerId }, orgId)).find(
      (m) => m.role === 'owner',
    )!.id
    otherMemberId = (
      await memberService.add(
        { userId: otherOwnerId },
        { organizationId: otherOrgId, userId: outsiderId },
      )
    ).id
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('owner and organizer exclude a player; the player loses access but is not blocked', async () => {
    const res = await request('POST', url(playerMemberId), {
      user: organizerId,
      body: { reason: 'Не платит взносы' },
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      member: { id: playerMemberId, status: 'left' },
      cancelledBookings: 0,
      paidSeats: 0,
    })
    expect(await statusOf(playerMemberId)).toBe('left')
    // доступа к группе нет
    expect((await request('GET', `/api/organizations/${orgId}/members`, { user: playerId })).status).toBe(
      403,
    )
    const second = await request('POST', url(otherPlayerMemberId), { user: ownerId, body: {} })
    expect(second.status).toBe(200)
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, 'member.excluded'), eq(auditLog.entityId, playerMemberId)))
    expect(entry).toMatchObject({ userId: organizerId, organizationId: orgId })
    expect(entry!.newValue).toMatchObject({ reason: 'Не платит взносы', status: 'left' })
  })

  it('refuses the owner and yourself (422), and admins for everyone but the owner (403)', async () => {
    const owner = await request('POST', url(ownerMemberId), { user: organizerId, body: {} })
    expect(owner.status).toBe(422)
    expect(owner.body).toMatchObject({ data: { code: 'member.cannot_exclude_owner' } })
    const self = await request('POST', url(organizerMemberId), { user: organizerId, body: {} })
    expect(self.status).toBe(422)
    expect(self.body).toMatchObject({ data: { code: 'member.cannot_exclude_self' } })
    const ownerSelf = await request('POST', url(ownerMemberId), { user: ownerId, body: {} })
    expect(ownerSelf.status).toBe(422)
    const admin = await request('POST', url(assistantMemberId), { user: organizerId, body: {} })
    expect(admin.status).toBe(403)
    expect(admin.body).toMatchObject({ data: { code: 'forbidden.exclude' } })
    expect(await statusOf(assistantMemberId)).toBe('active')
    const byOwner = await request('POST', url(assistantMemberId), { user: ownerId, body: {} })
    expect(byOwner.status).toBe(200)
  })

  it('a plain player, assistant and anonymous cannot exclude; nobody is changed', async () => {
    for (const user of [otherPlayerId, assistantId]) {
      const res = await request('POST', url(playerMemberId), { user, body: {} })
      expect(res.status).toBe(403)
    }
    expect((await request('POST', url(playerMemberId), { body: {} })).status).toBe(401)
    expect(await statusOf(playerMemberId)).toBe('active')
  })

  it('IDOR: a manager of another group and a foreign member id are refused', async () => {
    for (const user of [outsiderId, otherOwnerId]) {
      const res = await request('POST', url(playerMemberId), { user, body: {} })
      expect(res.status).toBe(403)
    }
    const foreign = await request('POST', url(otherMemberId), { user: ownerId, body: {} })
    expect(foreign.status).toBe(404)
    const otherPath = await request('POST', url(otherMemberId, otherOrgId), {
      user: ownerId,
      body: {},
    })
    expect(otherPath.status).toBe(403)
    expect((await request('POST', url(999_999), { user: ownerId, body: {} })).status).toBe(404)
    expect(await statusOf(playerMemberId)).toBe('active')
    expect(
      (await memberService.list({ userId: otherOwnerId }, otherOrgId)).find((m) => m.id === otherMemberId)
        ?.status,
    ).toBe('active')
  })

  it('a blocked player cannot be excluded (stays blocked); too-long reason is a validation error', async () => {
    await memberService.block({ userId: ownerId }, playerMemberId)
    const blocked = await request('POST', url(playerMemberId), { user: ownerId, body: {} })
    expect(blocked.status).toBe(409)
    expect(await statusOf(playerMemberId)).toBe('blocked')
    const long = await request('POST', url(otherPlayerMemberId), {
      user: ownerId,
      body: { reason: 'x'.repeat(501) },
    })
    expect(long.status).toBe(422)
    expect(await statusOf(otherPlayerMemberId)).toBe('active')
  })
})
