import {
  and,
  eq,
  gt,
  inviteLinks,
  isNull,
  or,
  sql,
  organizationMembers,
  organizations,
  type InviteLink,
  type OrganizationMember,
  asc,
  users,
} from '@volley-time/db'
import { nanoid } from 'nanoid'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { AlreadyMemberError, MemberBlockedByOrgError } from '../members/errors'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import {
  InviteExpiredError,
  InviteNotFoundError,
  InviteRevokedError,
  InviteUsesExhaustedError,
} from './errors'
import { CreateInviteInput, type CreateInviteInput as CreateInput } from './schemas'

export interface InvitePreview {
  status: 'valid' | 'revoked' | 'expired' | 'exhausted' | 'not_found'
  organization?: {
    id: number
    name: string
    city: string | null
    description: string | null
    membersCount: number
    avatars: { name: string | null; image: string | null; telegramUsername: string | null }[]
  }
  inviter?: { name: string | null; telegramUsername: string | null; role: string | null } | null
  roleToAssign?: string
  requiresApproval?: boolean
  myMembership?: { status: OrganizationMember['status']; role: OrganizationMember['role'] } | null
}

export const inviteService = {
  /** Создать инвайт-ссылку. Токен генерируется nanoid. */
  async create(outerCtx: ServiceContext, input: CreateInput): Promise<InviteLink> {
    const data = CreateInviteInput.parse(input)
    return inTransaction(outerCtx, (ctx) => this.createInTx(ctx, data))
  },

  async createInTx(
    ctx: ServiceContext,
    data: ReturnType<typeof CreateInviteInput.parse>,
  ): Promise<InviteLink> {
    const db = getDb(ctx)

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, data.organizationId),
    })
    const defaultStatus = data.defaultMemberStatus ?? org?.defaultMemberStatus ?? 'active'

    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null

    const [inv] = await db
      .insert(inviteLinks)
      .values({
        token: nanoid(16),
        organizationId: data.organizationId,
        type: 'organization_join',
        createdByUserId: ctx.userId,
        roleToAssign: data.roleToAssign,
        defaultMemberStatus: defaultStatus,
        maxUses: data.maxUses ?? null,
        expiresAt,
      })
      .returning()
    await auditService.record(ctx, {
      organizationId: data.organizationId,
      action: AUDIT_ACTIONS.INVITE_CREATED,
      entityType: 'invite',
      entityId: inv!.id,
      newValue: {
        roleToAssign: inv!.roleToAssign,
        maxUses: inv!.maxUses,
        expiresAt: inv!.expiresAt,
        defaultMemberStatus: inv!.defaultMemberStatus,
      },
    })
    return inv!
  },

  /** Получить инвайт по токену с проверкой валидности (revoked/expired/exhausted). */
  async getValidByToken(ctx: ServiceContext, token: string): Promise<InviteLink> {
    const inv = await getDb(ctx).query.inviteLinks.findFirst({
      where: eq(inviteLinks.token, token),
    })
    if (!inv) throw new InviteNotFoundError(token)
    if (inv.isRevoked) throw new InviteRevokedError()
    if (inv.expiresAt && inv.expiresAt < new Date()) throw new InviteExpiredError()
    if (inv.maxUses !== null && inv.usesCount >= inv.maxUses) throw new InviteUsesExhaustedError()
    return inv
  },

  /**
   * Использовать инвайт: добавить пользователя (ctx.userId) в организацию.
   * Первым шагом — атомарный условный инкремент uses_count (Task 4.9.3): строка блокируется,
   * лимит max_uses не превышается при любой конкуренции. Ошибка дальше откатывает инкремент.
   */
  async redeem(ctx: ServiceContext, token: string): Promise<OrganizationMember> {
    const db = getDb(ctx)
    return db.transaction(async (tx) => {
      const txCtx = { ...ctx, db: tx }
      const [inv] = await tx
        .update(inviteLinks)
        .set({ usesCount: sql`${inviteLinks.usesCount} + 1` })
        .where(
          and(
            eq(inviteLinks.token, token),
            eq(inviteLinks.isRevoked, false),
            or(isNull(inviteLinks.expiresAt), gt(inviteLinks.expiresAt, new Date())),
            sql`(${inviteLinks.maxUses} IS NULL OR ${inviteLinks.usesCount} < ${inviteLinks.maxUses})`,
          ),
        )
        .returning()
      if (!inv) {
        // точная причина (not_found / revoked / expired / exhausted)
        await this.getValidByToken({ ...ctx, db: tx }, token)
        throw new InviteUsesExhaustedError()
      }

      const org = await tx.query.organizations.findFirst({
        where: eq(organizations.id, inv.organizationId),
        columns: { status: true },
      })
      if (!org || org.status !== 'active') throw new InviteNotFoundError(token)

      const existing = await tx.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, inv.organizationId),
          eq(organizationMembers.userId, ctx.userId),
        ),
      })
      const status = inv.defaultMemberStatus as 'active' | 'pending'
      const role = inv.roleToAssign as 'player' | 'organizer' | 'assistant'

      if (existing) {
        if (existing.status === 'blocked') throw new MemberBlockedByOrgError()
        if (existing.status !== 'left' && existing.status !== 'rejected') {
          throw new AlreadyMemberError()
        }
        // вернувшийся участник: реактивация той же строки (Task 4.9.9)
        const [rejoined] = await tx
          .update(organizationMembers)
          .set({
            status,
            role,
            invitedByUserId: inv.createdByUserId,
            inviteId: inv.id,
            joinedAt: status === 'active' ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(organizationMembers.id, existing.id))
          .returning()
        await auditService.record(txCtx, {
          organizationId: inv.organizationId,
          action: AUDIT_ACTIONS.MEMBER_REJOINED,
          entityType: 'member',
          entityId: rejoined!.id,
          oldValue: { status: existing.status, role: existing.role },
          newValue: { status, role, inviteId: inv.id },
        })
        return rejoined!
      }

      const [member] = await tx
        .insert(organizationMembers)
        .values({
          organizationId: inv.organizationId,
          userId: ctx.userId,
          role,
          status,
          invitedByUserId: inv.createdByUserId,
          inviteId: inv.id,
          joinedAt: status === 'active' ? new Date() : null,
        })
        .returning()

      await auditService.record(txCtx, {
        organizationId: inv.organizationId,
        action: AUDIT_ACTIONS.INVITE_REDEEMED,
        entityType: 'invite',
        entityId: inv.id,
        newValue: { memberId: member!.id, status, role },
      })
      return member!
    })
  },

  /**
   * Превью приглашения для экрана принятия (Task 4.9.17). Не бросает на недействительном
   * инвайте — возвращает причину. Раскрывает только число участников и до 5 аватаров.
   */
  async preview(ctx: ServiceContext, token: string): Promise<InvitePreview> {
    const db = getDb(ctx)
    const inv = await db.query.inviteLinks.findFirst({ where: eq(inviteLinks.token, token) })
    if (!inv) return { status: 'not_found' }
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, inv.organizationId),
    })
    if (!org || org.status !== 'active') return { status: 'not_found' }

    let status: InvitePreview['status'] = 'valid'
    if (inv.isRevoked) status = 'revoked'
    else if (inv.expiresAt && inv.expiresAt < new Date()) status = 'expired'
    else if (inv.maxUses !== null && inv.usesCount >= inv.maxUses) status = 'exhausted'

    const [countRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, org.id),
          eq(organizationMembers.status, 'active'),
        ),
      )
    const avatars = await db
      .select({ name: users.name, image: users.image, telegramUsername: users.telegramUsername })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(
        and(
          eq(organizationMembers.organizationId, org.id),
          eq(organizationMembers.status, 'active'),
        ),
      )
      .orderBy(asc(organizationMembers.createdAt))
      .limit(5)
    const inviter = await db
      .select({
        name: users.name,
        telegramUsername: users.telegramUsername,
        role: organizationMembers.role,
      })
      .from(users)
      .leftJoin(
        organizationMembers,
        and(
          eq(organizationMembers.userId, users.id),
          eq(organizationMembers.organizationId, org.id),
        ),
      )
      .where(eq(users.id, inv.createdByUserId))
      .limit(1)
    const mine = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, org.id),
        eq(organizationMembers.userId, ctx.userId),
      ),
      columns: { status: true, role: true },
    })

    return {
      status,
      organization: {
        id: org.id,
        name: org.name,
        city: org.city,
        description: org.description,
        membersCount: countRow?.n ?? 0,
        avatars,
      },
      inviter: inviter[0]
        ? {
            name: inviter[0].name,
            telegramUsername: inviter[0].telegramUsername,
            role: inviter[0].role,
          }
        : null,
      roleToAssign: inv.roleToAssign,
      requiresApproval: inv.defaultMemberStatus === 'pending',
      myMembership: mine ?? null,
    }
  },

  /** Список инвайтов организации (для управляющих). */
  async listByOrg(ctx: ServiceContext, orgId: number): Promise<InviteLink[]> {
    return getDb(ctx).query.inviteLinks.findMany({
      where: eq(inviteLinks.organizationId, orgId),
      orderBy: (i, { desc }) => [desc(i.createdAt)],
    })
  },

  /** Отозвать инвайт своей организации. Чужой/несуществующий → InviteNotFoundError (Task 4.9.4). */
  async revoke(ctx: ServiceContext, orgId: number, inviteId: number): Promise<InviteLink> {
    return inTransaction(ctx, async (tx) => {
      const [revoked] = await getDb(tx)
        .update(inviteLinks)
        .set({ isRevoked: true })
        .where(and(eq(inviteLinks.id, inviteId), eq(inviteLinks.organizationId, orgId)))
        .returning()
      if (!revoked) throw new InviteNotFoundError(String(inviteId))
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.INVITE_REVOKED,
        entityType: 'invite',
        entityId: inviteId,
        newValue: { isRevoked: true },
      })
      return revoked
    })
  },
}
