import { inviteService, memberService, organizationService } from '@volley-time/core'
import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type ListedMember = {
  id: number
  status: string
  reason: string | null
  excludedBy: { id: number } | null
}

/** Task 21.2.24: вкладка «Исключённые», блокировка из `left`, «Исключить и заблокировать» (HTTP). */
describe('excluded players API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let organizer2Id: number
  let assistantId: number
  let playerId: number
  let player2Id: number
  let leaverId: number
  let outsiderId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  let organizerMemberId: number
  let organizer2MemberId: number
  let assistantMemberId: number
  let playerMemberId: number
  let player2MemberId: number
  let leaverMemberId: number
  let otherMemberId: number
  const base = () => `/api/organizations/${orgId}/members`
  const listExcluded = (user: number, id = orgId) =>
    request('GET', `/api/organizations/${id}/members/excluded`, { user })
  const excludedIds = async () =>
    ((await listExcluded(ownerId)).body as { members: ListedMember[] }).members.map((m) => m.id)
  const statusOf = async (memberId: number) => {
    const res = await request('GET', `${base()}?statuses=active,left,blocked`, { user: ownerId })
    return (res.body as { members: ListedMember[] }).members.find((m) => m.id === memberId)?.status
  }

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `exl-${tag}-${Math.random()}@t.by`, name: tag })
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
    organizer2Id = await newUser('organizer2')
    assistantId = await newUser('assistant')
    playerId = await newUser('player')
    player2Id = await newUser('player2')
    leaverId = await newUser('leaver')
    outsiderId = await newUser('outsider')
    otherOwnerId = await newUser('other-owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Excluded HTTP' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Other' })).id
    const add = async (userId: number, role: 'organizer' | 'assistant' | 'player') =>
      (await memberService.add({ userId: ownerId }, { organizationId: orgId, userId, role })).id
    organizerMemberId = await add(organizerId, 'organizer')
    organizer2MemberId = await add(organizer2Id, 'organizer')
    assistantMemberId = await add(assistantId, 'assistant')
    playerMemberId = await add(playerId, 'player')
    player2MemberId = await add(player2Id, 'player')
    leaverMemberId = await add(leaverId, 'player')
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

  it('lists excluded players with actor and reason; voluntary leavers are not there', async () => {
    await request('POST', `${base()}/${playerMemberId}/exclude`, {
      user: organizerId,
      body: { reason: 'Не платит' },
    })
    await request('POST', `${base()}/leave`, { user: leaverId, body: {} })
    const res = await listExcluded(organizerId)
    expect(res.status).toBe(200)
    const members = (res.body as { members: ListedMember[] }).members
    expect(members.map((m) => m.id)).toEqual([playerMemberId])
    expect(members[0]).toMatchObject({
      status: 'left',
      reason: 'Не платит',
      excludedBy: { id: organizerId },
    })
    expect(await statusOf(leaverMemberId)).toBe('left')
  })

  it('exclude with block: one request, blocked and out of the excluded list', async () => {
    const res = await request('POST', `${base()}/${playerMemberId}/exclude`, {
      user: organizerId,
      body: { reason: 'Спор', block: true },
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ blocked: true, member: { status: 'blocked' } })
    expect(await statusOf(playerMemberId)).toBe('blocked')
    expect(await excludedIds()).toEqual([])
    // вернуться по многоразовой ссылке нельзя
    const invite = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    await expect(inviteService.redeem({ userId: playerId }, invite.token)).rejects.toMatchObject({
      code: 'member.blocked',
    })
  })

  it('block from the excluded tab: manager blocks, a repeat is idempotent', async () => {
    await request('POST', `${base()}/${playerMemberId}/exclude`, { user: ownerId, body: {} })
    const first = await request('POST', `${base()}/${playerMemberId}/block`, { user: organizerId })
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ member: { status: 'blocked' } })
    const again = await request('POST', `${base()}/${playerMemberId}/block`, { user: organizerId })
    expect(again.status).toBe(200)
    expect(await statusOf(playerMemberId)).toBe('blocked')
  })

  it('unblock restores left for an excluded player (back in the list), active for a plain block', async () => {
    await request('POST', `${base()}/${playerMemberId}/exclude`, { user: ownerId, body: {} })
    await request('POST', `${base()}/${playerMemberId}/block`, { user: organizerId })
    expect(await excludedIds()).toEqual([])
    const res = await request('POST', `${base()}/${playerMemberId}/unblock`, { user: organizerId })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ member: { status: 'left' } })
    expect(await excludedIds()).toEqual([playerMemberId])
    // вернуться можно только по приглашению, автоматической активации нет
    expect(await statusOf(playerMemberId)).toBe('left')

    await request('POST', `${base()}/${player2MemberId}/block`, { user: organizerId })
    const plain = await request('POST', `${base()}/${player2MemberId}/unblock`, {
      user: organizerId,
    })
    expect(plain.body).toMatchObject({ member: { status: 'active' } })
  })

  it('an organizer cannot exclude+block or block an excluded organizer/assistant; the owner can', async () => {
    for (const memberId of [organizer2MemberId, assistantMemberId]) {
      const res = await request('POST', `${base()}/${memberId}/exclude`, {
        user: organizerId,
        body: { block: true },
      })
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'forbidden.exclude' } })
      expect(await statusOf(memberId)).toBe('active')
    }
    // владелец исключает помощника без блокировки; организатор не может его заблокировать
    await request('POST', `${base()}/${assistantMemberId}/exclude`, { user: ownerId, body: {} })
    const denied = await request('POST', `${base()}/${assistantMemberId}/block`, {
      user: organizerId,
    })
    expect(denied.status).toBe(403)
    expect(await statusOf(assistantMemberId)).toBe('left')
    const byOwner = await request('POST', `${base()}/${assistantMemberId}/block`, { user: ownerId })
    expect(byOwner.status).toBe(200)
    expect(await statusOf(assistantMemberId)).toBe('blocked')
    const ownerAll = await request('POST', `${base()}/${organizer2MemberId}/exclude`, {
      user: ownerId,
      body: { block: true },
    })
    expect(ownerAll.status).toBe(200)
    expect(await statusOf(organizer2MemberId)).toBe('blocked')
    expect(organizerMemberId).toBeGreaterThan(0)
  })

  it('a non-boolean block flag is a validation error and changes nothing', async () => {
    const res = await request('POST', `${base()}/${playerMemberId}/exclude`, {
      user: ownerId,
      body: { block: 'yes' },
    })
    expect(res.status).toBe(422)
    expect(await statusOf(playerMemberId)).toBe('active')
  })

  it('IDOR: players, assistants, anonymous, another group manager cannot list or block', async () => {
    await request('POST', `${base()}/${playerMemberId}/exclude`, { user: ownerId, body: {} })
    for (const user of [player2Id, assistantId, outsiderId, otherOwnerId]) {
      expect((await listExcluded(user)).status).toBe(403)
      const res = await request('POST', `${base()}/${playerMemberId}/block`, { user })
      expect(res.status).toBe(403)
      const both = await request('POST', `${base()}/${player2MemberId}/exclude`, {
        user,
        body: { block: true },
      })
      expect(both.status).toBe(403)
    }
    expect((await request('GET', `${base()}/excluded`, {})).status).toBe(401)
    expect(await statusOf(playerMemberId)).toBe('left')
    expect(await statusOf(player2MemberId)).toBe('active')
  })

  it('IDOR: a foreign member id is 404 through our group, and our list never shows other groups', async () => {
    const foreignBlock = await request('POST', `${base()}/${otherMemberId}/block`, {
      user: ownerId,
    })
    expect(foreignBlock.status).toBe(404)
    const foreignBoth = await request('POST', `${base()}/${otherMemberId}/exclude`, {
      user: ownerId,
      body: { block: true },
    })
    expect(foreignBoth.status).toBe(404)
    // исключённый чужой группы не виден владельцу нашей
    await request('POST', `/api/organizations/${otherOrgId}/members/${otherMemberId}/exclude`, {
      user: otherOwnerId,
      body: {},
    })
    expect(await excludedIds()).toEqual([])
    const theirs = (await listExcluded(otherOwnerId, otherOrgId)).body as {
      members: ListedMember[]
    }
    expect(theirs.members.map((m) => m.id)).toEqual([otherMemberId])
    // чужой управляющий не получает наш список
    expect((await listExcluded(otherOwnerId, orgId)).status).toBe(403)
  })
})
