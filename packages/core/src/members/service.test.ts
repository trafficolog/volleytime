import { closeDb, db, organizationMembers, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

import {
  AlreadyMemberError,
  CannotBlockOwnerError,
  CannotChangeOwnerRoleError,
  OwnerCannotLeaveError,
} from './errors'
import { memberService } from './service'

let ownerId: number
let orgId: number
let ownerMemberId: number

describe('memberService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [owner] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = owner!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Test Org' })
    orgId = org.id
    const [om] = await db.select().from(organizationMembers)
    ownerMemberId = om!.id
  })

  async function makePlayer() {
    const [u] = await db
      .insert(users)
      .values({ email: `pl-${Math.random()}@t.by` })
      .returning()
    return u!.id
  }

  it('adds a player member with joinedAt when active', async () => {
    const uid = await makePlayer()
    const m = await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: uid })
    expect(m.role).toBe('player')
    expect(m.status).toBe('active')
    expect(m.joinedAt).toBeInstanceOf(Date)
  })

  it('rejects duplicate membership', async () => {
    const uid = await makePlayer()
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: uid })
    await expect(
      memberService.add({ userId: ownerId }, { organizationId: orgId, userId: uid }),
    ).rejects.toThrow(AlreadyMemberError)
  })

  it('pending member has no joinedAt', async () => {
    const uid = await makePlayer()
    const m = await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: uid, status: 'pending' },
    )
    expect(m.status).toBe('pending')
    expect(m.joinedAt).toBeNull()
  })

  it('changes member role', async () => {
    const uid = await makePlayer()
    const m = await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: uid })
    const updated = await memberService.changeRole({ userId: ownerId }, m.id, 'organizer')
    expect(updated.role).toBe('organizer')
  })

  it('cannot change owner role', async () => {
    await expect(
      memberService.changeRole({ userId: ownerId }, ownerMemberId, 'organizer'),
    ).rejects.toThrow(CannotChangeOwnerRoleError)
  })

  it('SECURITY: rejects owner role (escalation, 4.9.1)', async () => {
    const uid = await makePlayer()
    const m = await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: uid })
    await expect(
      memberService.changeRole({ userId: ownerId }, m.id, 'owner' as never),
    ).rejects.toThrow()
  })

  it('SECURITY: member cannot change own role (4.9.1)', async () => {
    const uid = await makePlayer()
    const m = await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: uid, role: 'organizer' },
    )
    await expect(memberService.changeRole({ userId: uid }, m.id, 'player')).rejects.toThrow(
      /own role/,
    )
  })

  it('listWithUsers exposes only public user fields (4.9.13)', async () => {
    const [u] = await db
      .insert(users)
      .values({
        email: 'secret@t.by',
        phone: '+375',
        name: 'Никита',
        telegramUserId: 777n,
        telegramUsername: 'nik',
      })
      .returning()
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
    const list = await memberService.listWithUsers({ userId: ownerId }, orgId)
    const nik = list.find((m) => m.user.id === u!.id)!
    expect(nik.user).toEqual({ id: u!.id, name: 'Никита', telegramUsername: 'nik', image: null })
    const json = JSON.stringify(list)
    expect(json).not.toContain('secret@t.by')
    expect(json).not.toContain('+375')
    expect(list[0]!.role).toBe('owner')
  })

  it('blocks a player', async () => {
    const uid = await makePlayer()
    const m = await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: uid })
    const blocked = await memberService.block({ userId: ownerId }, m.id)
    expect(blocked.status).toBe('blocked')
  })

  it('cannot block owner', async () => {
    await expect(memberService.block({ userId: ownerId }, ownerMemberId)).rejects.toThrow(
      CannotBlockOwnerError,
    )
  })

  it('lists members (owner + added)', async () => {
    const uid = await makePlayer()
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: uid })
    const members = await memberService.list({ userId: ownerId }, orgId)
    expect(members).toHaveLength(2)
  })

  it('list filters by status', async () => {
    const uid = await makePlayer()
    const m = await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: uid })
    await memberService.block({ userId: ownerId }, m.id)
    const active = await memberService.list({ userId: ownerId }, orgId, ['active'])
    expect(active.every((x) => x.status === 'active')).toBe(true)
    const blocked = await memberService.list({ userId: ownerId }, orgId, ['blocked'])
    expect(blocked).toHaveLength(1)
  })

  it('player can leave org (status -> left)', async () => {
    const uid = await makePlayer()
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: uid })
    const left = await memberService.leaveOrg({ userId: uid }, orgId)
    expect(left.status).toBe('left')
  })

  it('leaveOrg is idempotent', async () => {
    const uid = await makePlayer()
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: uid })
    await memberService.leaveOrg({ userId: uid }, orgId)
    const again = await memberService.leaveOrg({ userId: uid }, orgId)
    expect(again.status).toBe('left')
  })

  it('owner cannot leave', async () => {
    await expect(memberService.leaveOrg({ userId: ownerId }, orgId)).rejects.toThrow(
      OwnerCannotLeaveError,
    )
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
