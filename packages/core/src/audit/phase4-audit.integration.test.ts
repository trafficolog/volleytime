import { auditLog, closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { inviteService } from '../invites/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

/** Task 4.9.5 (review 4 P1#5): каждая мутация Phase 4 пишет audit в той же транзакции. */
describe('Phase 4 audit wiring (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })

  it('records the full lifecycle in order with actor', async () => {
    const [owner] = await db.insert(users).values({ email: 'audit-owner@t.by' }).returning()
    const [player] = await db.insert(users).values({ email: 'audit-player@t.by' }).returning()
    const o = { userId: owner!.id }
    const org = await organizationService.create(o, { name: 'Audit Club' })
    await organizationService.update(o, org.id, { city: 'Минск' })
    const inv = await inviteService.create(o, { organizationId: org.id })
    const m = await inviteService.redeem({ userId: player!.id }, inv.token)
    await memberService.changeRole(o, m.id, 'assistant')
    await memberService.block(o, m.id)
    await inviteService.revoke(o, org.id, inv.id)
    await organizationService.archive(o, org.id)

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.organizationId, org.id))
      .orderBy(auditLog.id)
    expect(rows.map((r) => r.action)).toEqual([
      'organization.created',
      'member.added',
      'organization.updated',
      'invite.created',
      'invite.redeemed',
      'member.role_changed',
      'member.blocked',
      'invite.revoked',
      'organization.archived',
    ])
    expect(rows.find((r) => r.action === 'invite.redeemed')?.userId).toBe(player!.id)
    expect(rows.find((r) => r.action === 'member.role_changed')?.newValue).toEqual({
      role: 'assistant',
    })
  })

  it('failed mutation leaves no audit entry', async () => {
    const [owner] = await db.insert(users).values({ email: 'audit-o2@t.by' }).returning()
    const org = await organizationService.create({ userId: owner!.id }, { name: 'Audit Two' })
    const before = await db.select().from(auditLog).where(eq(auditLog.organizationId, org.id))
    await expect(memberService.leaveOrg({ userId: owner!.id }, org.id)).rejects.toThrow()
    const after = await db.select().from(auditLog).where(eq(auditLog.organizationId, org.id))
    expect(after).toHaveLength(before.length)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
