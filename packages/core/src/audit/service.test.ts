import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

import { AUDIT_ACTIONS } from './actions'
import { auditService } from './service'

let ownerId: number
let orgId: number

describe('auditService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `a-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Audit Org' })
    orgId = org.id
  })

  it('logs an entry', async () => {
    const entry = await auditService.log(
      { userId: ownerId },
      {
        organizationId: orgId,
        action: AUDIT_ACTIONS.MEMBER_ADDED,
        entityType: 'member',
        entityId: 1,
      },
    )
    expect(entry?.action).toBe('member.added')
    expect(entry?.userId).toBe(ownerId)
  })

  it('stores old/new values as jsonb', async () => {
    const entry = await auditService.log(
      { userId: ownerId },
      {
        organizationId: orgId,
        action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
        entityType: 'member',
        entityId: 2,
        oldValue: { role: 'player' },
        newValue: { role: 'organizer' },
      },
    )
    expect(entry?.oldValue).toEqual({ role: 'player' })
    expect(entry?.newValue).toEqual({ role: 'organizer' })
  })

  it('lists org entries newest first', async () => {
    await auditService.log(
      { userId: ownerId },
      {
        organizationId: orgId,
        action: AUDIT_ACTIONS.MEMBER_ADDED,
        entityType: 'member',
        entityId: 1,
      },
    )
    await auditService.log(
      { userId: ownerId },
      {
        organizationId: orgId,
        action: AUDIT_ACTIONS.MEMBER_BLOCKED,
        entityType: 'member',
        entityId: 1,
      },
    )
    const list = await auditService.listByOrg({ userId: ownerId }, orgId)
    expect(list.length).toBeGreaterThanOrEqual(2)
    expect(list[0]?.createdAt.getTime()).toBeGreaterThanOrEqual(list[1]!.createdAt.getTime())
  })

  it('filters by action', async () => {
    await auditService.log(
      { userId: ownerId },
      {
        organizationId: orgId,
        action: AUDIT_ACTIONS.MEMBER_ADDED,
        entityType: 'member',
        entityId: 1,
      },
    )
    await auditService.log(
      { userId: ownerId },
      {
        organizationId: orgId,
        action: AUDIT_ACTIONS.INVITE_CREATED,
        entityType: 'invite',
        entityId: 1,
      },
    )
    const filtered = await auditService.listByOrg({ userId: ownerId }, orgId, {
      action: 'invite.created',
    })
    expect(filtered.every((e) => e.action === 'invite.created')).toBe(true)
    expect(filtered).toHaveLength(1)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
