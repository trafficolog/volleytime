import {
  closeDb,
  db,
  eq,
  inviteLinks,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

import { inviteService } from './service'

/** Task 4.9.3 (review 4 P1#3): 25 параллельных redeem при maxUses=2 → ровно 2. */
describe('invite redeem race (integration)', () => {
  let ownerId: number
  let orgId: number

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [o] = await db.insert(users).values({ email: `race-owner@t.by` }).returning()
    ownerId = o!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Race Org' })).id
  })

  it('never exceeds maxUses under concurrency (5 runs)', async () => {
    for (let run = 0; run < 5; run++) {
      const inv = await inviteService.create(
        { userId: ownerId },
        { organizationId: orgId, maxUses: 2 },
      )
      const players = await db
        .insert(users)
        .values(Array.from({ length: 25 }, (_, i) => ({ email: `r${run}-${i}@t.by` })))
        .returning()
      const results = await Promise.allSettled(
        players.map((p) => inviteService.redeem({ userId: p.id }, inv.token)),
      )
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2)
      const [row] = await db.select().from(inviteLinks).where(eq(inviteLinks.id, inv.id))
      expect(row!.usesCount).toBe(2)
      const joined = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.inviteId, inv.id))
      expect(joined).toHaveLength(2)
    }
  })

  it('already-member does not consume a use', async () => {
    const inv = await inviteService.create(
      { userId: ownerId },
      { organizationId: orgId, maxUses: 5 },
    )
    await expect(inviteService.redeem({ userId: ownerId }, inv.token)).rejects.toThrow()
    const [row] = await db.select().from(inviteLinks).where(eq(inviteLinks.id, inv.id))
    expect(row!.usesCount).toBe(0)
  })

  it('member who left can rejoin; blocked cannot (4.9.9)', async () => {
    const { memberService } = await import('../members/service')
    const [p] = await db.insert(users).values({ email: 'rejoin@t.by' }).returning()
    const inv1 = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    const m = await inviteService.redeem({ userId: p!.id }, inv1.token)
    await memberService.leaveOrg({ userId: p!.id }, orgId)
    const inv2 = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    const back = await inviteService.redeem({ userId: p!.id }, inv2.token)
    expect(back.id).toBe(m.id)
    expect(back.status).toBe('active')
    expect(back.inviteId).toBe(inv2.id)

    await memberService.block({ userId: ownerId }, m.id)
    const inv3 = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
    await expect(inviteService.redeem({ userId: p!.id }, inv3.token)).rejects.toThrow(/blocked/)
  })

  it('SECURITY: cannot revoke invite of another organization (4.9.4)', async () => {
    const [o2] = await db.insert(users).values({ email: 'owner-b@t.by' }).returning()
    const orgB = await organizationService.create({ userId: o2!.id }, { name: 'Org B' })
    const invB = await inviteService.create({ userId: o2!.id }, { organizationId: orgB.id })
    await expect(inviteService.revoke({ userId: ownerId }, orgId, invB.id)).rejects.toThrow(
      /not found/,
    )
    const [row] = await db.select().from(inviteLinks).where(eq(inviteLinks.id, invB.id))
    expect(row!.isRevoked).toBe(false)
    const own = await inviteService.revoke({ userId: o2!.id }, orgB.id, invB.id)
    expect(own.isRevoked).toBe(true)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
