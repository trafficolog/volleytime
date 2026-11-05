import { memberService, organizationService } from '@volley-time/core'
import { and, auditLog, closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/** Task 21.2.22: амплуа игрока по членству в группе (HTTP, права, IDOR, audit). */
describe('player position API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let assistantId: number
  let playerId: number
  let outsiderId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  let playerMemberId: number
  let otherMemberId: number
  const positionUrl = (memberId = playerMemberId, id = orgId) =>
    `/api/organizations/${id}/members/${memberId}/position`
  const listMembers = async (user = ownerId, id = orgId) => {
    const res = await request('GET', `/api/organizations/${id}/members`, { user })
    return (res.body as { members: { id: number; position: string | null }[] }).members
  }
  const positionOf = async (user = ownerId) =>
    (await listMembers(user)).find((m) => m.id === playerMemberId)?.position

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `pp-${tag}-${Math.random()}@t.by` })
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
    outsiderId = await newUser('outsider')
    otherOwnerId = await newUser('other-owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Position HTTP' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Other' })).id
    const add = (userId: number, role: 'organizer' | 'assistant' | 'player') =>
      memberService.add({ userId: ownerId }, { organizationId: orgId, userId, role })
    await add(organizerId, 'organizer')
    await add(assistantId, 'assistant')
    playerMemberId = (await add(playerId, 'player')).id
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

  it('owner and organizer set and clear a position; every member sees it in the list', async () => {
    for (const [user, position] of [
      [ownerId, 'setter'],
      [organizerId, 'outside_hitter'],
      [organizerId, 'opposite'],
      [ownerId, 'middle_blocker'],
      [ownerId, 'libero'],
      [ownerId, 'utility'],
      [organizerId, null],
    ] as const) {
      const res = await request('PATCH', positionUrl(), { user, body: { position } })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ member: { id: playerMemberId, position } })
      expect(await positionOf(playerId)).toBe(position) // игрок видит своё амплуа
    }
  })

  it('the position is empty by default', async () => {
    expect((await listMembers(playerId)).every((m) => m.position === null)).toBe(true)
  })

  it('the player cannot set a position, not even their own; assistant and anonymous are refused', async () => {
    for (const user of [playerId, assistantId]) {
      const res = await request('PATCH', positionUrl(), { user, body: { position: 'setter' } })
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'forbidden.manage_content' } })
    }
    expect((await request('PATCH', positionUrl(), { body: { position: 'setter' } })).status).toBe(
      401,
    )
    expect(await positionOf()).toBeNull()
  })

  it('IDOR: another group cannot set a position, and a foreign member id is a 404', async () => {
    for (const user of [outsiderId, otherOwnerId]) {
      const res = await request('PATCH', positionUrl(), { user, body: { position: 'setter' } })
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'permission.not_member' } })
    }
    const foreign = await request('PATCH', positionUrl(otherMemberId), {
      user: ownerId,
      body: { position: 'setter' },
    })
    expect(foreign.status).toBe(404)
    const otherPath = await request('PATCH', positionUrl(otherMemberId, otherOrgId), {
      user: ownerId,
      body: { position: 'setter' },
    })
    expect(otherPath.status).toBe(403)
    expect((await listMembers(otherOwnerId, otherOrgId)).every((m) => m.position === null)).toBe(
      true,
    )
    expect(
      (
        await request('PATCH', positionUrl(999_999), {
          user: ownerId,
          body: { position: 'setter' },
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await request('PATCH', positionUrl('abc' as never), {
          user: ownerId,
          body: { position: 'setter' },
        })
      ).status,
    ).toBe(400)
  })

  it('rejects invalid input with 422 and leaves the position as it was', async () => {
    await request('PATCH', positionUrl(), { user: ownerId, body: { position: 'libero' } })
    for (const body of [
      { position: 'goalkeeper' },
      { position: 'Setter' },
      { position: 1 },
      { position: '' },
      {},
      { position: 'setter', role: 'owner' },
      { level: 'v1' },
    ]) {
      const res = await request('PATCH', positionUrl(), { user: ownerId, body })
      expect(res.status).toBe(422)
    }
    expect(await positionOf()).toBe('libero')
  })

  it('refuses members who are blocked, left or rejected', async () => {
    await memberService.block({ userId: ownerId }, playerMemberId)
    const res = await request('PATCH', positionUrl(), {
      user: ownerId,
      body: { position: 'setter' },
    })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ data: { code: 'member.position_not_assignable' } })
  })

  it('writes the change to audit_log and skips no-ops', async () => {
    await request('PATCH', positionUrl(), { user: organizerId, body: { position: 'setter' } })
    await request('PATCH', positionUrl(), { user: organizerId, body: { position: 'setter' } })
    await request('PATCH', positionUrl(), { user: ownerId, body: { position: 'libero' } })
    const rows = await db
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.organizationId, orgId), eq(auditLog.action, 'member.position_changed')),
      )
      .orderBy(auditLog.id)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      userId: organizerId,
      entityType: 'member',
      entityId: playerMemberId,
      oldValue: { position: null },
      newValue: { position: 'setter' },
    })
    expect(rows[1]).toMatchObject({
      userId: ownerId,
      oldValue: { position: 'setter' },
      newValue: { position: 'libero' },
    })
  })

  it('does not touch the level, and belongs to the group: it does not leak into another group', async () => {
    await memberService.add(
      { userId: otherOwnerId },
      { organizationId: otherOrgId, userId: playerId },
    )
    await request('PATCH', `/api/organizations/${orgId}/members/${playerMemberId}/level`, {
      user: ownerId,
      body: { level: 'v2' },
    })
    await request('PATCH', positionUrl(), { user: ownerId, body: { position: 'setter' } })
    const mine = (await listMembers()).find((m) => m.id === playerMemberId)
    expect(mine).toMatchObject({ position: 'setter', level: 'v2' })
    const other = (await listMembers(otherOwnerId, otherOrgId)).filter((m) => m.position)
    expect(other).toHaveLength(0)
  })

  it('exposes the own position through the organization endpoint (myMember)', async () => {
    await request('PATCH', positionUrl(), { user: ownerId, body: { position: 'opposite' } })
    const res = await request('GET', `/api/organizations/${orgId}`, { user: playerId })
    expect(res.body).toMatchObject({ myMember: { position: 'opposite' } })
  })
})
