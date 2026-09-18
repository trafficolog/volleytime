import {
  and,
  eq,
  organizationMembers,
  organizations,
  type Organization,
  type OrganizationMember,
} from '@volley-time/db'

import { getDb, type ServiceContext } from '../shared/context'

import {
  MemberBlockedError,
  NoLongerMemberError,
  NotMemberError,
  OrgArchivedError,
  OrgNotFoundError,
  OrgSuspendedError,
} from './errors'

export interface TenantContext {
  organization: Organization
  member: OrganizationMember
}

/**
 * Разрешить tenant: загрузить организацию и membership пользователя (ctx.userId),
 * проверить статусы org (active) и membership (не left/rejected/blocked).
 * Бросает TenantError (с httpStatus) при нарушении.
 */
export async function resolveTenant(ctx: ServiceContext, orgId: number): Promise<TenantContext> {
  const db = getDb(ctx)

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!organization) throw new OrgNotFoundError()
  if (organization.status === 'archived') throw new OrgArchivedError()
  if (organization.status === 'suspended') throw new OrgSuspendedError()

  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.userId, ctx.userId),
    ),
  })
  if (!member) throw new NotMemberError()
  if (member.status === 'left' || member.status === 'rejected') throw new NoLongerMemberError()
  if (member.status === 'blocked') throw new MemberBlockedError()

  return { organization, member }
}
