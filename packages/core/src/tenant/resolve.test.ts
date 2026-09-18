import { closeDb, db, eq, organizationMembers, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

import {
  MemberBlockedError,
  NoLongerMemberError,
  NotMemberError,
  OrgArchivedError,
  OrgSuspendedError,
} from './errors'
import { resolveTenant } from './resolve'

let ownerId: number
let orgId: number

async function newUser() {
  const [u] = await db
    .insert(users)
    .values({ email: `u-${Math.random()}@t.by` })
    .returning()
  return u!.id
}

describe('resolveTenant (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser()
    const org = await organizationService.create({ userId: ownerId }, { name: 'Tenant Org' })
    orgId = org.id
  })

  it('resolves org + owner membership', async () => {
    const result = await resolveTenant({ userId: ownerId }, orgId)
    expect(result.organization.id).toBe(orgId)
    expect(result.member.role).toBe('owner')
  })

  it('throws NotMemberError for non-member', async () => {
    const outsider = await newUser()
    await expect(resolveTenant({ userId: outsider }, orgId)).rejects.toThrow(NotMemberError)
  })

  it('throws OrgArchivedError for archived org', async () => {
    await organizationService.archive({ userId: ownerId }, orgId)
    await expect(resolveTenant({ userId: ownerId }, orgId)).rejects.toThrow(OrgArchivedError)
  })

  it('throws OrgSuspendedError for suspended org', async () => {
    await db.update(organizations).set({ status: 'suspended' }).where(eq(organizations.id, orgId))
    await expect(resolveTenant({ userId: ownerId }, orgId)).rejects.toThrow(OrgSuspendedError)
  })

  it('throws MemberBlockedError for blocked member', async () => {
    const uid = await newUser()
    await db
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: uid, status: 'blocked' })
    await expect(resolveTenant({ userId: uid }, orgId)).rejects.toThrow(MemberBlockedError)
  })

  it('throws NoLongerMemberError for left member', async () => {
    const uid = await newUser()
    await db
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: uid, status: 'left' })
    await expect(resolveTenant({ userId: uid }, orgId)).rejects.toThrow(NoLongerMemberError)
  })

  it('TenantError carries httpStatus', async () => {
    const outsider = await newUser()
    try {
      await resolveTenant({ userId: outsider }, orgId)
      expect.fail('should throw')
    } catch (e) {
      expect((e as { httpStatus: number }).httpStatus).toBe(403)
      expect((e as { code: string }).code).toBe('permission.not_member')
    }
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
