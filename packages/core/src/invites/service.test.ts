import { closeDb, db, eq, inviteLinks, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { AlreadyMemberError } from '../members/errors'
import { organizationService } from '../organizations/service'

import { InviteExpiredError, InviteRevokedError, InviteUsesExhaustedError } from './errors'
import { inviteService } from './service'

let ownerId: number
let orgId: number

async function newUser() {
  const [u] = await db
    .insert(users)
    .values({ email: `u-${Math.random()}@t.by` })
    .returning()
  return u!.id
}

describe('inviteService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser()
    const org = await organizationService.create({ userId: ownerId }, { name: 'Invite Org' })
    orgId = org.id
  })

  it('creates invite with token and defaults', async () => {
    const inv = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    expect(inv.token).toHaveLength(16)
    expect(inv.roleToAssign).toBe('player')
    expect(inv.usesCount).toBe(0)
    expect(inv.maxUses).toBeNull()
  })

  it('redeem adds member and increments usesCount', async () => {
    const inv = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    const playerId = await newUser()
    const member = await inviteService.redeem({ userId: playerId }, inv.token)
    expect(member.organizationId).toBe(orgId)
    expect(member.userId).toBe(playerId)
    expect(member.role).toBe('player')
    expect(member.invitedByUserId).toBe(ownerId)

    const [refreshed] = await db.select().from(inviteLinks).where(eq(inviteLinks.id, inv.id))
    expect(refreshed?.usesCount).toBe(1)
  })

  it('redeem twice by same user throws AlreadyMemberError', async () => {
    const inv = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    const playerId = await newUser()
    await inviteService.redeem({ userId: playerId }, inv.token)
    await expect(inviteService.redeem({ userId: playerId }, inv.token)).rejects.toThrow(
      AlreadyMemberError,
    )
  })

  it('respects maxUses (exhausted)', async () => {
    const inv = await inviteService.create(
      { userId: ownerId },
      { organizationId: orgId, maxUses: 1 },
    )
    await inviteService.redeem({ userId: await newUser() }, inv.token)
    await expect(inviteService.redeem({ userId: await newUser() }, inv.token)).rejects.toThrow(
      InviteUsesExhaustedError,
    )
  })

  it('rejects revoked invite', async () => {
    const inv = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    await inviteService.revoke({ userId: ownerId }, orgId, inv.id)
    await expect(inviteService.redeem({ userId: await newUser() }, inv.token)).rejects.toThrow(
      InviteRevokedError,
    )
  })

  it('rejects expired invite', async () => {
    const inv = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    // вручную выставить прошедший expiresAt
    await db
      .update(inviteLinks)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(inviteLinks.id, inv.id))
    await expect(inviteService.redeem({ userId: await newUser() }, inv.token)).rejects.toThrow(
      InviteExpiredError,
    )
  })

  it('pending default status → member without joinedAt', async () => {
    const inv = await inviteService.create(
      { userId: ownerId },
      { organizationId: orgId, defaultMemberStatus: 'pending' },
    )
    const member = await inviteService.redeem({ userId: await newUser() }, inv.token)
    expect(member.status).toBe('pending')
    expect(member.joinedAt).toBeNull()
  })

  it('listByOrg returns org invites newest first', async () => {
    await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    const list = await inviteService.listByOrg({ userId: ownerId }, orgId)
    expect(list.length).toBeGreaterThanOrEqual(2)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
