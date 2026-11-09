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
  OrgDeletedError,
  OrgNotFoundError,
  OrgSuspendedError,
} from './errors'

export interface TenantContext {
  organization: Organization
  member: OrganizationMember
}

export interface ResolveTenantOptions {
  /**
   * Пропустить действующего owner к мягко удалённой группе (21.2.17): только для чтения карточки
   * группы и восстановления. Остальным и на остальных маршрутах удалённая группа — 410.
   */
  allowDeletedForOwner?: boolean
}

/**
 * Разрешить tenant: загрузить организацию и membership пользователя (ctx.userId),
 * проверить статусы org (active, не удалена) и membership (не left/rejected/blocked).
 * Бросает TenantError (с httpStatus) при нарушении. Удалённая группа проверяется после членства:
 * посторонний получает тот же 403 `permission.not_member`, что и для живой группы.
 */
export async function resolveTenant(
  ctx: ServiceContext,
  orgId: number,
  opts: ResolveTenantOptions = {},
): Promise<TenantContext> {
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
  if (organization.deletedAt !== null) {
    const owner =
      member.role === 'owner' &&
      member.status === 'active' &&
      organization.ownerUserId === ctx.userId
    if (!(opts.allowDeletedForOwner && owner)) throw new OrgDeletedError()
  }

  return { organization, member }
}
