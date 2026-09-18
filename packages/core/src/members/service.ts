import {
  and,
  asc,
  eq,
  inArray,
  organizationMembers,
  users,
  type OrganizationMember,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import {
  AlreadyMemberError,
  CannotBlockOwnerError,
  CannotChangeOwnerRoleError,
  CannotChangeOwnRoleError,
  MemberInvalidTransitionError,
  MemberNotFoundError,
  OwnerCannotLeaveError,
} from './errors'
import { AddMemberInput, ChangeMemberRoleInput, type AddMemberInput as AddInput } from './schemas'

const snapshot = (m: OrganizationMember) => ({ role: m.role, status: m.status })

/** Участник с публичными полями пользователя (без email/phone/telegram id). Task 4.9.13. */
export interface MemberWithUser {
  id: number
  organizationId: number
  role: OrganizationMember['role']
  status: OrganizationMember['status']
  joinedAt: Date | null
  createdAt: Date
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
}

export const memberService = {
  /** Добавить участника. Ошибка если уже состоит. */
  async add(ctx: ServiceContext, input: AddInput): Promise<OrganizationMember> {
    const data = AddMemberInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const existing = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, data.organizationId),
          eq(organizationMembers.userId, data.userId),
        ),
      })
      if (existing) throw new AlreadyMemberError()

      const [m] = await db
        .insert(organizationMembers)
        .values({
          organizationId: data.organizationId,
          userId: data.userId,
          role: data.role,
          status: data.status,
          invitedByUserId: data.invitedByUserId ?? null,
          joinedAt: data.status === 'active' ? new Date() : null,
        })
        .returning()
      await auditService.record(tx, {
        organizationId: data.organizationId,
        action: AUDIT_ACTIONS.MEMBER_ADDED,
        entityType: 'member',
        entityId: m!.id,
        newValue: snapshot(m!),
      })
      return m!
    })
  },

  async getById(ctx: ServiceContext, memberId: number): Promise<OrganizationMember> {
    const m = await getDb(ctx).query.organizationMembers.findFirst({
      where: eq(organizationMembers.id, memberId),
    })
    if (!m) throw new MemberNotFoundError(memberId)
    return m
  },

  /**
   * Сменить роль. Owner-роль неизменяема и не назначается; свою роль сменить нельзя
   * (защита от эскалации, Task 4.9.1). Проверка «только owner» — в политике на API-слое.
   */
  async changeRole(
    ctx: ServiceContext,
    memberId: number,
    role: 'organizer' | 'assistant' | 'player',
  ): Promise<OrganizationMember> {
    const { role: validRole } = ChangeMemberRoleInput.parse({ role })
    return inTransaction(ctx, async (tx) => {
      const m = await this.getById(tx, memberId)
      if (ctx.organization && m.organizationId !== ctx.organization.id) {
        throw new MemberNotFoundError(memberId)
      }
      if (m.role === 'owner') throw new CannotChangeOwnerRoleError()
      if (m.userId === ctx.userId) throw new CannotChangeOwnRoleError()

      const [updated] = await getDb(tx)
        .update(organizationMembers)
        .set({ role: validRole, updatedAt: new Date() })
        .where(eq(organizationMembers.id, memberId))
        .returning()
      await auditService.record(tx, {
        organizationId: m.organizationId,
        action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
        entityType: 'member',
        entityId: m.id,
        oldValue: { role: m.role },
        newValue: { role: validRole },
      })
      return updated!
    })
  },

  /**
   * Переход статуса участника с проверкой исходного статуса и audit (Task 4.9.8).
   * Владельца модерировать нельзя. Права актора проверяет политика requireCanModerate.
   */
  async transition(
    ctx: ServiceContext,
    memberId: number,
    to: 'active' | 'rejected' | 'blocked',
    allowedFrom: OrganizationMember['status'][],
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
  ): Promise<OrganizationMember> {
    return inTransaction(ctx, async (tx) => {
      const m = await this.getById(tx, memberId)
      if (ctx.organization && m.organizationId !== ctx.organization.id) {
        throw new MemberNotFoundError(memberId)
      }
      if (m.role === 'owner') throw new CannotBlockOwnerError()
      if (!allowedFrom.includes(m.status)) throw new MemberInvalidTransitionError(m.status, to)

      const [updated] = await getDb(tx)
        .update(organizationMembers)
        .set({
          status: to,
          ...(to === 'active' && !m.joinedAt ? { joinedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(organizationMembers.id, memberId), eq(organizationMembers.status, m.status)))
        .returning()
      if (!updated) throw new MemberInvalidTransitionError(m.status, to) // гонка
      await auditService.record(tx, {
        organizationId: m.organizationId,
        action,
        entityType: 'member',
        entityId: m.id,
        oldValue: snapshot(m),
        newValue: snapshot(updated),
      })
      return updated
    })
  },

  /** Заблокировать участника (active/pending). Owner заблокировать нельзя. */
  async block(ctx: ServiceContext, memberId: number): Promise<OrganizationMember> {
    return this.transition(
      ctx,
      memberId,
      'blocked',
      ['active', 'pending', 'guest'],
      AUDIT_ACTIONS.MEMBER_BLOCKED,
    )
  },

  async unblock(ctx: ServiceContext, memberId: number): Promise<OrganizationMember> {
    return this.transition(ctx, memberId, 'active', ['blocked'], AUDIT_ACTIONS.MEMBER_UNBLOCKED)
  },

  async approve(ctx: ServiceContext, memberId: number): Promise<OrganizationMember> {
    return this.transition(ctx, memberId, 'active', ['pending'], AUDIT_ACTIONS.MEMBER_APPROVED)
  },

  async reject(ctx: ServiceContext, memberId: number): Promise<OrganizationMember> {
    return this.transition(ctx, memberId, 'rejected', ['pending'], AUDIT_ACTIONS.MEMBER_REJECTED)
  },

  /** Покинуть организацию (self). Owner не может уйти. Идемпотентно. */
  async leaveOrg(ctx: ServiceContext, orgId: number): Promise<OrganizationMember> {
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const member = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, ctx.userId),
        ),
      })
      if (!member) throw new MemberNotFoundError(`org ${orgId} user ${ctx.userId}`)
      if (member.status === 'left') return member
      if (member.role === 'owner') throw new OwnerCannotLeaveError()
      const [updated] = await db
        .update(organizationMembers)
        .set({ status: 'left', updatedAt: new Date() })
        .where(eq(organizationMembers.id, member.id))
        .returning()
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.MEMBER_LEFT,
        entityType: 'member',
        entityId: member.id,
        oldValue: snapshot(member),
        newValue: snapshot(updated!),
      })
      return updated!
    })
  },

  /** Состав с именами/username/фото. Порядок: owner → organizer → assistant → player, затем по дате. */
  async listWithUsers(
    ctx: ServiceContext,
    orgId: number,
    statuses: OrganizationMember['status'][] = ['active'],
  ): Promise<MemberWithUser[]> {
    const rows = await getDb(ctx)
      .select({
        id: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
        status: organizationMembers.status,
        joinedAt: organizationMembers.joinedAt,
        createdAt: organizationMembers.createdAt,
        userId: users.id,
        name: users.name,
        telegramUsername: users.telegramUsername,
        image: users.image,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          inArray(organizationMembers.status, statuses),
        ),
      )
      .orderBy(asc(organizationMembers.role), asc(organizationMembers.createdAt))
    return rows.map(({ userId, name, telegramUsername, image, ...m }) => ({
      ...m,
      user: { id: userId, name, telegramUsername, image },
    }))
  },

  async list(
    ctx: ServiceContext,
    orgId: number,
    statuses?: string[],
  ): Promise<OrganizationMember[]> {
    const db = getDb(ctx)
    const where =
      statuses && statuses.length > 0
        ? and(
            eq(organizationMembers.organizationId, orgId),
            inArray(organizationMembers.status, statuses as ('active' | 'pending')[]),
          )
        : eq(organizationMembers.organizationId, orgId)
    return db.query.organizationMembers.findMany({
      where,
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    })
  },
}
