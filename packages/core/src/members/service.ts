import {
  and,
  asc,
  auditLog,
  desc,
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
  MemberLevelNotAssignableError,
  MemberNotFoundError,
  MemberPositionNotAssignableError,
  OwnerCannotLeaveError,
} from './errors'
import {
  AddMemberInput,
  ChangeMemberRoleInput,
  SetMemberLevelInput,
  SetMemberPositionInput,
  type AddMemberInput as AddInput,
} from './schemas'

const snapshot = (m: OrganizationMember) => ({ role: m.role, status: m.status })

/** Уровень можно назначить заявителю, активному участнику и гостю. */
const LEVEL_ASSIGNABLE_STATUSES: OrganizationMember['status'][] = ['pending', 'active', 'guest']

/** Участник с публичными полями пользователя (без email/phone/telegram id). Task 4.9.13. */
export interface MemberWithUser {
  id: number
  organizationId: number
  role: OrganizationMember['role']
  status: OrganizationMember['status']
  /** Уровень игрока в группе (19.2.3); null — не назначен. */
  level: OrganizationMember['level']
  /** Амплуа игрока в группе (21.2.22); null — не задано. */
  position: OrganizationMember['position']
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
   * Назначить или снять (null) уровень игрока в группе (19.2.3). Уровень принадлежит участнику
   * группы, а не пользователю. Уровень не назначается заблокированным, вышедшим и отклонённым.
   * Права актора (canManageContent) проверяет API-слой; участник чужой группы — «не найден».
   * Без изменения значения записи в audit нет.
   */
  async setLevel(
    ctx: ServiceContext,
    memberId: number,
    input: SetMemberLevelInput,
  ): Promise<OrganizationMember> {
    const { level } = SetMemberLevelInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const [m] = await getDb(tx)
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.id, memberId))
        .for('update')
      if (!m || (ctx.organization && m.organizationId !== ctx.organization.id)) {
        throw new MemberNotFoundError(memberId)
      }
      if (!LEVEL_ASSIGNABLE_STATUSES.includes(m.status)) {
        throw new MemberLevelNotAssignableError(m.status)
      }
      if (m.level === level) return m
      const [updated] = await getDb(tx)
        .update(organizationMembers)
        .set({ level, updatedAt: new Date() })
        .where(eq(organizationMembers.id, memberId))
        .returning()
      await auditService.record(tx, {
        organizationId: m.organizationId,
        action: AUDIT_ACTIONS.MEMBER_LEVEL_CHANGED,
        entityType: 'member',
        entityId: m.id,
        oldValue: { level: m.level },
        newValue: { level },
      })
      return updated!
    })
  },

  /**
   * Назначить или снять (null) амплуа игрока в группе (21.2.22). Как уровень, амплуа принадлежит
   * участнику группы и задаётся управляющим; игрок его только видит. Не назначается заблокированным,
   * вышедшим и отклонённым. Права актора (canManageContent) проверяет API-слой; участник чужой
   * группы — «не найден». Без изменения значения записи в audit нет.
   */
  async setPosition(
    ctx: ServiceContext,
    memberId: number,
    input: SetMemberPositionInput,
  ): Promise<OrganizationMember> {
    const { position } = SetMemberPositionInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const [m] = await getDb(tx)
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.id, memberId))
        .for('update')
      if (!m || (ctx.organization && m.organizationId !== ctx.organization.id)) {
        throw new MemberNotFoundError(memberId)
      }
      if (!LEVEL_ASSIGNABLE_STATUSES.includes(m.status)) {
        throw new MemberPositionNotAssignableError(m.status)
      }
      if (m.position === position) return m
      const [updated] = await getDb(tx)
        .update(organizationMembers)
        .set({ position, updatedAt: new Date() })
        .where(eq(organizationMembers.id, memberId))
        .returning()
      await auditService.record(tx, {
        organizationId: m.organizationId,
        action: AUDIT_ACTIONS.MEMBER_POSITION_CHANGED,
        entityType: 'member',
        entityId: m.id,
        oldValue: { position: m.position },
        newValue: { position },
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
    to: 'active' | 'rejected' | 'blocked' | 'left',
    allowedFrom: OrganizationMember['status'][],
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
    options: {
      idempotent?: boolean
      /** Целевой статус, зависящий от участника (разблокировка), считается в той же транзакции. */
      resolveTo?: (tx: ServiceContext, m: OrganizationMember) => Promise<typeof to>
    } = {},
  ): Promise<OrganizationMember> {
    return inTransaction(ctx, async (tx) => {
      const m = await this.getById(tx, memberId)
      if (ctx.organization && m.organizationId !== ctx.organization.id) {
        throw new MemberNotFoundError(memberId)
      }
      if (m.role === 'owner') throw new CannotBlockOwnerError()
      if (options.resolveTo && allowedFrom.includes(m.status)) to = await options.resolveTo(tx, m)
      // повторное действие в целевом статусе: без изменений и без записи в audit
      if (options.idempotent && m.status === to) return m
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

  /**
   * Заблокировать участника (active/pending/guest, а также `left`: вышедший или исключённый, 21.2.24,
   * чтобы он не вернулся по многоразовой ссылке). Owner заблокировать нельзя. Повторная блокировка
   * идемпотентна: статус и audit не меняются.
   */
  async block(ctx: ServiceContext, memberId: number): Promise<OrganizationMember> {
    return this.transition(
      ctx,
      memberId,
      'blocked',
      ['active', 'pending', 'guest', 'left'],
      AUDIT_ACTIONS.MEMBER_BLOCKED,
      { idempotent: true },
    )
  },

  /**
   * Разблокировать участника: возвращается статус, который был до блокировки. Если последняя
   * запись `member.blocked` по участнику имеет oldValue.status = 'left' (вышедший или исключённый,
   * 21.2.24), он остаётся `left` и вернуться может только по приглашению; иначе `active`.
   */
  async unblock(ctx: ServiceContext, memberId: number): Promise<OrganizationMember> {
    return this.transition(ctx, memberId, 'active', ['blocked'], AUDIT_ACTIONS.MEMBER_UNBLOCKED, {
      resolveTo: async (tx, m) => {
        const [last] = await getDb(tx)
          .select({ oldValue: auditLog.oldValue })
          .from(auditLog)
          .where(
            and(
              eq(auditLog.organizationId, m.organizationId),
              eq(auditLog.entityType, 'member'),
              eq(auditLog.entityId, m.id),
              eq(auditLog.action, AUDIT_ACTIONS.MEMBER_BLOCKED),
            ),
          )
          .orderBy(desc(auditLog.id))
          .limit(1)
        return (last?.oldValue as { status?: unknown } | null)?.status === 'left'
          ? 'left'
          : 'active'
      },
    })
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
        level: organizationMembers.level,
        position: organizationMembers.position,
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
