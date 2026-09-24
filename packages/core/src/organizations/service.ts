import {
  and,
  eq,
  inArray,
  ne,
  organizationMembers,
  organizations,
  type Organization,
} from '@volley-time/db'
import { slugify, uniqueSlug } from '@volley-time/shared'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import {
  OrganizationArchivedError,
  OrganizationNotFoundError,
  OrganizationSubscriptionsDisabledError,
  SlugTakenError,
} from './errors'
import {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  type CreateOrganizationInput as CreateInput,
  type UpdateOrganizationInput as UpdateInput,
} from './schemas'

export type OrganizationWithMembership = Organization & {
  membershipStatus: 'active' | 'pending'
  membershipRole: 'owner' | 'organizer' | 'assistant' | 'player'
}

export const organizationService = {
  /**
   * Создать организацию. Атомарно: org + owner-membership.
   * Slug: из input (проверка занятости) или авто из name (уникальный).
   */
  async create(ctx: ServiceContext, input: CreateInput): Promise<Organization> {
    const data = CreateOrganizationInput.parse(input)
    const db = getDb(ctx)

    return db.transaction(async (tx) => {
      const slugExists = async (s: string): Promise<boolean> => {
        const found = await tx.query.organizations.findFirst({
          where: eq(organizations.slug, s),
          columns: { id: true },
        })
        return !!found
      }

      let slug: string
      if (data.slug) {
        if (await slugExists(data.slug)) throw new SlugTakenError(data.slug)
        slug = data.slug
      } else {
        slug = await uniqueSlug(slugify(data.name), slugExists)
      }

      const [org] = await tx
        .insert(organizations)
        .values({
          slug,
          name: data.name,
          description: data.description ?? null,
          city: data.city ?? null,
          ownerUserId: ctx.userId,
          defaultMemberStatus: data.defaultMemberStatus ?? 'active',
        })
        .returning()
      if (!org) throw new Error('Failed to create organization')

      // owner-membership
      const [ownerMember] = await tx
        .insert(organizationMembers)
        .values({
          organizationId: org.id,
          userId: ctx.userId,
          role: 'owner',
          status: 'active',
          joinedAt: new Date(),
        })
        .returning()

      const txCtx = { ...ctx, db: tx }
      await auditService.record(txCtx, {
        organizationId: org.id,
        action: AUDIT_ACTIONS.ORG_CREATED,
        entityType: 'organization',
        entityId: org.id,
        newValue: { name: org.name, slug: org.slug },
      })
      await auditService.record(txCtx, {
        organizationId: org.id,
        action: AUDIT_ACTIONS.MEMBER_ADDED,
        entityType: 'member',
        entityId: ownerMember!.id,
        newValue: { role: 'owner', status: 'active' },
      })

      return org
    })
  },

  /**
   * Организации пользователя: active и pending (заявка) — с ролью и статусом членства,
   * чтобы UI показал «Заявка на рассмотрении» (Task 4.9.7). Архивные скрыты (4.9.10).
   */
  async listForUser(ctx: ServiceContext): Promise<OrganizationWithMembership[]> {
    const db = getDb(ctx)
    const memberships = await db.query.organizationMembers.findMany({
      where: and(
        eq(organizationMembers.userId, ctx.userId),
        inArray(organizationMembers.status, ['active', 'pending']),
      ),
      columns: { organizationId: true, status: true, role: true },
    })
    if (memberships.length === 0) return []
    const byOrg = new Map(memberships.map((m) => [m.organizationId, m]))
    const orgs = await db.query.organizations.findMany({
      where: and(
        inArray(organizations.id, [...byOrg.keys()]),
        ne(organizations.status, 'archived'),
      ),
      orderBy: (o, { asc }) => [asc(o.name)],
    })
    return orgs.map((o) => ({
      ...o,
      membershipStatus: byOrg.get(o.id)!.status as 'active' | 'pending',
      membershipRole: byOrg.get(o.id)!.role,
    }))
  },

  async getById(ctx: ServiceContext, orgId: number): Promise<Organization> {
    const org = await getDb(ctx).query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    })
    if (!org) throw new OrganizationNotFoundError(orgId)
    return org
  },

  async requireSubscriptionsEnabled(ctx: ServiceContext, orgId: number): Promise<void> {
    const [org] = await getDb(ctx)
      .select({ subscriptionsEnabled: organizations.subscriptionsEnabled })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .for('share')
    if (!org) throw new OrganizationNotFoundError(orgId)
    if (!org.subscriptionsEnabled) throw new OrganizationSubscriptionsDisabledError()
  },

  async update(ctx: ServiceContext, orgId: number, input: UpdateInput): Promise<Organization> {
    const data = UpdateOrganizationInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const [existing] = await getDb(tx)
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .for('update')
      if (!existing) throw new OrganizationNotFoundError(orgId)
      if (existing.status === 'archived') throw new OrganizationArchivedError()

      const [updated] = await getDb(tx)
        .update(organizations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
        .returning()
      const keys = Object.keys(data) as (keyof typeof data)[]
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.ORG_UPDATED,
        entityType: 'organization',
        entityId: orgId,
        oldValue: Object.fromEntries(keys.map((k) => [k, existing[k as keyof Organization]])),
        newValue: data,
      })
      return updated!
    })
  },

  async archive(ctx: ServiceContext, orgId: number): Promise<Organization> {
    return inTransaction(ctx, async (tx) => {
      const existing = await this.getById(tx, orgId)
      const [archived] = await getDb(tx)
        .update(organizations)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
        .returning()
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.ORG_ARCHIVED,
        entityType: 'organization',
        entityId: orgId,
        oldValue: { status: existing.status },
        newValue: { status: 'archived' },
      })
      return archived!
    })
  },
}
