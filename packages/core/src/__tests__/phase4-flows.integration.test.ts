import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { inviteService } from '../invites/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { NotMemberError } from '../tenant/errors'
import { resolveTenant } from '../tenant/resolve'

async function newUser() {
  const [u] = await db
    .insert(users)
    .values({ email: `f-${Math.random()}@t.by` })
    .returning()
  return u!.id
}

describe('Phase 4 — end-to-end flows (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })

  it('full flow: create org → invite → redeem → member joined → tenant resolves', async () => {
    const ownerId = await newUser()
    const org = await organizationService.create({ userId: ownerId }, { name: 'Flow Club' })

    const invite = await inviteService.create({ userId: ownerId }, { organizationId: org.id })

    const playerId = await newUser()
    const member = await inviteService.redeem({ userId: playerId }, invite.token)
    expect(member.role).toBe('player')
    expect(member.status).toBe('active')

    // player now resolves tenant successfully
    const tenant = await resolveTenant({ userId: playerId }, org.id)
    expect(tenant.member.userId).toBe(playerId)

    // members list has owner + player
    const members = await memberService.list({ userId: ownerId }, org.id)
    expect(members).toHaveLength(2)
  })

  it('security: non-member cannot resolve tenant (isolation)', async () => {
    const ownerId = await newUser()
    const org = await organizationService.create({ userId: ownerId }, { name: 'Private' })
    const outsider = await newUser()
    await expect(resolveTenant({ userId: outsider }, org.id)).rejects.toThrow(NotMemberError)
  })

  it('security: member of org A is not member of org B', async () => {
    const ownerA = await newUser()
    const orgA = await organizationService.create({ userId: ownerA }, { name: 'Org A' })
    const ownerB = await newUser()
    const orgB = await organizationService.create({ userId: ownerB }, { name: 'Org B' })

    const player = await newUser()
    const inv = await inviteService.create({ userId: ownerA }, { organizationId: orgA.id })
    await inviteService.redeem({ userId: player }, inv.token)

    // player is in A, not in B
    await expect(resolveTenant({ userId: player }, orgB.id)).rejects.toThrow(NotMemberError)
  })

  it('race: concurrent redeem by same user → exactly one membership', async () => {
    const ownerId = await newUser()
    const org = await organizationService.create({ userId: ownerId }, { name: 'Race Club' })
    const invite = await inviteService.create({ userId: ownerId }, { organizationId: org.id })
    const playerId = await newUser()

    // две параллельные попытки: одна успех, другая AlreadyMember (или обе успех запрещены unique)
    const results = await Promise.allSettled([
      inviteService.redeem({ userId: playerId }, invite.token),
      inviteService.redeem({ userId: playerId }, invite.token),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    // ровно одно membership в БД (unique org+user гарантирует)
    const members = await memberService.list({ userId: ownerId }, org.id)
    const playerMembers = members.filter((m) => m.userId === playerId)
    expect(playerMembers).toHaveLength(1)
    expect(fulfilled.length).toBeGreaterThanOrEqual(1)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
