import { memberService, organizationService } from '@volley-time/core'
import { and, auditLog, closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

const CODES = ['v1', 'v2', 'v3', 'v4', 'v4_plus']

/** Task 19.2.3: GET /api/levels, уровень игрока, уровни группы и события (HTTP, права, IDOR). */
describe('player levels API (HTTP integration)', () => {
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
  const levelUrl = (memberId = playerMemberId, id = orgId) =>
    `/api/organizations/${id}/members/${memberId}/level`
  const listMembers = async (user = ownerId, id = orgId) => {
    const res = await request('GET', `/api/organizations/${id}/members`, { user })
    return (res.body as { members: { id: number; level: string | null }[] }).members
  }

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `lv-${tag}-${Math.random()}@t.by` })
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
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Levels HTTP' })).id
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

  describe('GET /api/levels', () => {
    it('returns the directory in scale order to any authenticated user', async () => {
      for (const user of [playerId, outsiderId]) {
        const res = await request('GET', '/api/levels', { user })
        expect(res.status).toBe(200)
        const { levels } = res.body as { levels: Record<string, unknown>[] }
        expect(levels.map((l) => l.code)).toEqual(CODES)
        expect(levels.map((l) => l.title)).toEqual(['В1', 'В2', 'В3', 'В4', 'В4+'])
        expect(levels.map((l) => l.sortOrder)).toEqual([1, 2, 3, 4, 5])
        for (const l of levels) expect(l.description).toEqual(expect.any(String))
      }
    })

    it('refuses an unauthenticated caller', async () => {
      expect((await request('GET', '/api/levels')).status).toBe(401)
    })
  })

  describe('PATCH /members/{memberId}/level', () => {
    it('owner and organizer set and clear a level; it shows in the members list', async () => {
      for (const [user, level] of [
        [ownerId, 'v2'],
        [organizerId, 'v4_plus'],
        [organizerId, null],
      ] as const) {
        const res = await request('PATCH', levelUrl(), { user, body: { level } })
        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({ member: { id: playerMemberId, level } })
        const member = (await listMembers(playerId)).find((m) => m.id === playerMemberId)
        expect(member?.level).toBe(level)
      }
    })

    it('assistant, player and unauthenticated callers are refused without changes', async () => {
      for (const user of [assistantId, playerId]) {
        const res = await request('PATCH', levelUrl(), { user, body: { level: 'v1' } })
        expect(res.status).toBe(403)
        expect(res.body).toMatchObject({ data: { code: 'forbidden.manage_content' } })
      }
      expect((await request('PATCH', levelUrl(), { body: { level: 'v1' } })).status).toBe(401)
      expect((await listMembers()).find((m) => m.id === playerMemberId)?.level).toBeNull()
    })

    it('IDOR: another group cannot set a level, and a foreign member id is a 404', async () => {
      // посторонний и владелец другой группы не участвуют в этой
      for (const user of [outsiderId, otherOwnerId]) {
        const res = await request('PATCH', levelUrl(), { user, body: { level: 'v1' } })
        expect(res.status).toBe(403)
        expect(res.body).toMatchObject({ data: { code: 'permission.not_member' } })
      }
      // владелец своей группы с id участника чужой группы
      const foreign = await request('PATCH', levelUrl(otherMemberId), {
        user: ownerId,
        body: { level: 'v1' },
      })
      expect(foreign.status).toBe(404)
      // id чужой группы в пути: владелец своей группы там не участник
      const otherPath = await request('PATCH', levelUrl(otherMemberId, otherOrgId), {
        user: ownerId,
        body: { level: 'v1' },
      })
      expect(otherPath.status).toBe(403)
      expect((await listMembers(otherOwnerId, otherOrgId)).every((m) => m.level === null)).toBe(
        true,
      )
      expect(
        (await request('PATCH', levelUrl(999_999), { user: ownerId, body: { level: 'v1' } }))
          .status,
      ).toBe(404)
      expect(
        (await request('PATCH', levelUrl('abc' as never), { user: ownerId, body: { level: 'v1' } }))
          .status,
      ).toBe(400)
    })

    it('rejects invalid input with 422 and leaves the level as it was', async () => {
      await request('PATCH', levelUrl(), { user: ownerId, body: { level: 'v3' } })
      for (const body of [
        { level: 'A' },
        { level: 'B' },
        { level: 'b1' },
        { level: 3 },
        { level: '' },
        {},
        { level: 'v1', role: 'owner' },
        { levels: ['v1'] },
      ]) {
        const res = await request('PATCH', levelUrl(), { user: ownerId, body })
        expect(res.status).toBe(422)
      }
      expect((await listMembers()).find((m) => m.id === playerMemberId)?.level).toBe('v3')
    })

    it('refuses members who are blocked, left or rejected', async () => {
      await memberService.block({ userId: ownerId }, playerMemberId)
      const res = await request('PATCH', levelUrl(), { user: ownerId, body: { level: 'v1' } })
      expect(res.status).toBe(409)
      expect(res.body).toMatchObject({ data: { code: 'member.level_not_assignable' } })
    })

    it('writes the change to audit_log and skips no-ops', async () => {
      await request('PATCH', levelUrl(), { user: organizerId, body: { level: 'v2' } })
      await request('PATCH', levelUrl(), { user: organizerId, body: { level: 'v2' } }) // без изменений
      await request('PATCH', levelUrl(), { user: ownerId, body: { level: 'v3' } })
      const rows = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.organizationId, orgId), eq(auditLog.action, 'member.level_changed')))
        .orderBy(auditLog.id)
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({
        userId: organizerId,
        entityType: 'member',
        entityId: playerMemberId,
        oldValue: { level: null },
        newValue: { level: 'v2' },
      })
      expect(rows[1]).toMatchObject({
        userId: ownerId,
        oldValue: { level: 'v2' },
        newValue: { level: 'v3' },
      })
    })

    it('the level belongs to the group: it does not leak into the same user in another group', async () => {
      await memberService.add(
        { userId: otherOwnerId },
        { organizationId: otherOrgId, userId: playerId },
      )
      await request('PATCH', levelUrl(), { user: ownerId, body: { level: 'v1' } })
      const other = (await listMembers(otherOwnerId, otherOrgId)).filter((m) => m.level)
      expect(other).toHaveLength(0)
    })
  })

  describe('levels of a group (settings)', () => {
    const settingsUrl = () => `/api/organizations/${orgId}/settings`

    it('stores several levels in scale order without duplicates and returns them', async () => {
      const res = await request('PATCH', settingsUrl(), {
        user: ownerId,
        body: { levels: ['v4', 'v2', 'v4', 'v3'] },
      })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ settings: { levels: ['v2', 'v3', 'v4'] } })
      const get = await request('GET', settingsUrl(), { user: organizerId })
      expect(get.body).toMatchObject({ settings: { levels: ['v2', 'v3', 'v4'] } })
    })

    it('defaults to an empty list, can be cleared, and is owner-only and validated', async () => {
      const initial = await request('GET', settingsUrl(), { user: ownerId })
      expect(initial.body).toMatchObject({ settings: { levels: [] } })
      await request('PATCH', settingsUrl(), { user: ownerId, body: { levels: ['v1'] } })
      const cleared = await request('PATCH', settingsUrl(), { user: ownerId, body: { levels: [] } })
      expect(cleared.body).toMatchObject({ settings: { levels: [] } })

      const denied = await request('PATCH', settingsUrl(), {
        user: organizerId,
        body: { levels: ['v1'] },
      })
      expect(denied.status).toBe(403)
      for (const levels of [['A'], ['v1', 'x'], 'v1', [1], CODES.concat('v1')]) {
        const bad = await request('PATCH', settingsUrl(), { user: ownerId, body: { levels } })
        expect(bad.status).toBe(422)
      }
    })

    it('does not change another group', async () => {
      await request('PATCH', settingsUrl(), { user: ownerId, body: { levels: ['v1', 'v2'] } })
      const other = await request('GET', `/api/organizations/${otherOrgId}/settings`, {
        user: otherOwnerId,
      })
      expect(other.body).toMatchObject({ settings: { levels: [] } })
    })
  })

  describe('level of an event', () => {
    const eventsUrl = () => `/api/organizations/${orgId}/events`
    const payload = (extra: object = {}) => ({
      title: 'С уровнем',
      startsAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 26 * 3600_000).toISOString(),
      capacity: 10,
      price: 0,
      ...extra,
    })

    it('is optional on create, can be set on update and cleared', async () => {
      const plain = await request('POST', eventsUrl(), { user: ownerId, body: payload() })
      expect(plain.body).toMatchObject({ event: { level: null } })

      const created = await request('POST', eventsUrl(), {
        user: ownerId,
        body: payload({ title: 'В3', level: 'v3' }),
      })
      expect(created.status).toBe(200)
      const id = (created.body as { event: { id: number } }).event.id
      expect(created.body).toMatchObject({ event: { level: 'v3' } })

      const changed = await request('PATCH', `${eventsUrl()}/${id}`, {
        user: organizerId,
        body: { level: 'v2' },
      })
      expect(changed.body).toMatchObject({ event: { level: 'v2' } })
      const cleared = await request('PATCH', `${eventsUrl()}/${id}`, {
        user: ownerId,
        body: { level: null },
      })
      expect(cleared.body).toMatchObject({ event: { level: null } })
    })

    it('rejects unknown codes and players cannot set it', async () => {
      const bad = await request('POST', eventsUrl(), {
        user: ownerId,
        body: payload({ level: 'A' }),
      })
      expect(bad.status).toBe(422)
      const denied = await request('POST', eventsUrl(), {
        user: playerId,
        body: payload({ level: 'v1' }),
      })
      expect(denied.status).toBe(403)
    })
  })
})
