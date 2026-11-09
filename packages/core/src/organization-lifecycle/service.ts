import {
  and,
  db as defaultDb,
  eq,
  gt,
  isNotNull,
  lte,
  organizationMembers,
  organizationOwnershipTransfers,
  organizations,
  users,
  type DbOrTx,
  type Organization,
  type OrganizationOwnershipTransfer,
} from '@volley-time/db'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { OrganizationArchivedError, OrganizationNotFoundError } from '../organizations/errors'
import { ForbiddenError } from '../permissions/errors'
import { getDb, systemContext, type ServiceContext } from '../shared/context'
import { OrgDeletedError } from '../tenant/errors'

import {
  generateTransferToken,
  hashTransferToken,
  isTransferTokenShape,
  OWNERSHIP_TRANSFER_TTL_MS,
  restoreWindowDays,
} from './config'
import {
  DeleteBlockedByTransferError,
  DeleteConfirmationMismatchError,
  OrganizationLifecycleError,
  OrganizationNotDeletedError,
  OwnershipTransferCancelledError,
  OwnershipTransferExpiredError,
  OwnershipTransferInvalidError,
  OwnershipTransferPendingError,
  OwnershipTransferRecipientError,
  OwnershipTransferRecipientGoneError,
  OwnershipTransferUsedError,
  RestoreWindowClosedError,
} from './errors'

export const StartOwnershipTransferInput = z.object({
  recipientMemberId: z.number().int().positive(),
})
export type StartOwnershipTransferInput = z.infer<typeof StartOwnershipTransferInput>

export const DeleteOrganizationInput = z.object({
  confirmName: z.string().max(200),
})
export type DeleteOrganizationInput = z.infer<typeof DeleteOrganizationInput>

/** Ожидающая передача для «Опасной зоны»: кому и до какого времени. Токена здесь нет никогда. */
export interface PendingTransferView {
  id: number
  toUserId: number
  toMemberId: number | null
  toName: string | null
  expiresAt: Date
  createdAt: Date
}

export type TransferPreviewStatus = 'pending' | 'accepted' | 'cancelled' | 'expired' | 'invalid'

export interface TransferPreview {
  status: TransferPreviewStatus
  organization: { id: number; name: string } | null
  fromName: string | null
  expiresAt: Date | null
}

export interface DeletedOrganizationView {
  id: number
  name: string
  deletedAt: Date
  restoreUntil: Date
  restorable: boolean
}

const isUniqueViolation = (e: unknown, constraint: string) =>
  !!e &&
  typeof e === 'object' &&
  (e as { code?: string }).code === '23505' &&
  JSON.stringify(e).includes(constraint)

const displayName = (u: { name: string | null; telegramUsername: string | null } | undefined) =>
  u?.name ?? (u?.telegramUsername ? `@${u.telegramUsername}` : null)

/**
 * Строка группы под `FOR UPDATE` и проверка, что действующий owner — автор запроса. Права
 * проверяются ещё раз под блокировкой: между tenant middleware и транзакцией владелец мог
 * смениться (параллельное принятие передачи), и прежний owner не должен успеть выполнить действие.
 */
async function lockOwnedOrg(tx: DbOrTx, userId: number, orgId: number): Promise<Organization> {
  const [org] = await tx
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .for('update')
  if (!org) throw new OrganizationNotFoundError(orgId)
  const [member] = await tx
    .select({ role: organizationMembers.role, status: organizationMembers.status })
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)),
    )
  if (
    !member ||
    member.role !== 'owner' ||
    member.status !== 'active' ||
    org.ownerUserId !== userId
  )
    throw new ForbiddenError('forbidden.owner_only', 'Действие доступно только владельцу')
  return org
}

/** Закрыть истёкшие ожидающие передачи группы (`expired` + запись в журнал от системы). */
async function expireDue(tx: DbOrTx, orgId: number | null, now: Date): Promise<number> {
  const expired = await tx
    .update(organizationOwnershipTransfers)
    .set({ status: 'expired', resolvedAt: now })
    .where(
      and(
        eq(organizationOwnershipTransfers.status, 'pending'),
        lte(organizationOwnershipTransfers.expiresAt, now),
        orgId === null ? undefined : eq(organizationOwnershipTransfers.organizationId, orgId),
      ),
    )
    .returning()
  for (const t of expired) {
    await auditService.record(systemContext(tx), {
      organizationId: t.organizationId,
      action: AUDIT_ACTIONS.OWNERSHIP_TRANSFER_EXPIRED,
      entityType: 'ownership_transfer',
      entityId: t.id,
      oldValue: { status: 'pending' },
      newValue: { status: 'expired', fromUserId: t.fromUserId, toUserId: t.toUserId },
    })
  }
  return expired.length
}

async function pendingOf(tx: DbOrTx, orgId: number, now: Date) {
  const [row] = await tx
    .select({
      transfer: organizationOwnershipTransfers,
      toName: users.name,
      toUsername: users.telegramUsername,
      toMemberId: organizationMembers.id,
    })
    .from(organizationOwnershipTransfers)
    .innerJoin(users, eq(users.id, organizationOwnershipTransfers.toUserId))
    .leftJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, organizationOwnershipTransfers.organizationId),
        eq(organizationMembers.userId, organizationOwnershipTransfers.toUserId),
      ),
    )
    .where(
      and(
        eq(organizationOwnershipTransfers.organizationId, orgId),
        eq(organizationOwnershipTransfers.status, 'pending'),
        gt(organizationOwnershipTransfers.expiresAt, now),
      ),
    )
  return row
}

function view(
  t: OrganizationOwnershipTransfer,
  toName: string | null,
  toMemberId: number | null,
): PendingTransferView {
  return {
    id: t.id,
    toUserId: t.toUserId,
    toMemberId,
    toName,
    expiresAt: t.expiresAt,
    createdAt: t.createdAt,
  }
}

/**
 * Передача владения группой (21.2.17, D-15). Owner выбирает действующего участника и начинает
 * передачу; получатель принимает её по личной ссылке (одноразовый токен, привязанный к нему,
 * с истекающим сроком; в базе — только SHA-256). Владелец меняется только при принятии, в одной
 * транзакции под блокировкой строки группы: новый owner, прежний owner → organizer (умолчание
 * оркестратора), передача закрыта. Частичные уникальные индексы гарантируют одного owner и не
 * больше одной ожидающей передачи на группу даже при параллельных запросах.
 */
export const ownershipTransferService = {
  /** Текущая ожидающая передача группы (истёкшая уже не считается ожидающей). */
  async current(ctx: ServiceContext, orgId: number): Promise<PendingTransferView | null> {
    const row = await pendingOf(getDb(ctx), orgId, new Date())
    if (!row) return null
    return view(
      row.transfer,
      displayName({ name: row.toName, telegramUsername: row.toUsername }),
      row.toMemberId,
    )
  },

  /** Начать передачу. Токен возвращается один раз — показать owner, чтобы он отправил ссылку. */
  async start(
    ctx: ServiceContext,
    orgId: number,
    input: StartOwnershipTransferInput,
  ): Promise<{ transfer: PendingTransferView; token: string }> {
    const data = StartOwnershipTransferInput.parse(input)
    const now = new Date()
    try {
      return await getDb(ctx).transaction(async (tx) => {
        const org = await lockOwnedOrg(tx, ctx.userId, orgId)
        if (org.deletedAt) throw new OrgDeletedError()
        if (org.status === 'archived') throw new OrganizationArchivedError()
        await expireDue(tx, orgId, now)
        if (await pendingOf(tx, orgId, now)) throw new OwnershipTransferPendingError()

        const [recipient] = await tx
          .select({
            member: organizationMembers,
            name: users.name,
            telegramUsername: users.telegramUsername,
            isActive: users.isActive,
          })
          .from(organizationMembers)
          .innerJoin(users, eq(users.id, organizationMembers.userId))
          .where(eq(organizationMembers.id, data.recipientMemberId))
        // участник другой группы неотличим от несуществующего: ответ не раскрывает чужую группу
        if (!recipient || recipient.member.organizationId !== orgId)
          throw new OwnershipTransferRecipientError('Recipient is not a member of this group')
        if (recipient.member.userId === ctx.userId)
          throw new OwnershipTransferRecipientError('Cannot transfer ownership to yourself')
        if (recipient.member.status !== 'active' || !recipient.isActive)
          throw new OwnershipTransferRecipientError('Recipient is not an active member')

        const token = generateTransferToken()
        const [transfer] = await tx
          .insert(organizationOwnershipTransfers)
          .values({
            organizationId: orgId,
            fromUserId: ctx.userId,
            toUserId: recipient.member.userId,
            tokenHash: hashTransferToken(token),
            expiresAt: new Date(now.getTime() + OWNERSHIP_TRANSFER_TTL_MS),
            createdAt: now,
          })
          .returning()
        await auditService.record(
          { ...ctx, db: tx },
          {
            organizationId: orgId,
            action: AUDIT_ACTIONS.OWNERSHIP_TRANSFER_STARTED,
            entityType: 'ownership_transfer',
            entityId: transfer!.id,
            newValue: {
              toUserId: recipient.member.userId,
              toMemberId: recipient.member.id,
              expiresAt: transfer!.expiresAt.toISOString(),
            },
          },
        )
        return {
          transfer: view(transfer!, displayName(recipient), recipient.member.id),
          token,
        }
      })
    } catch (e) {
      // параллельный старт той же группы: второй упирается в частичный уникальный индекс
      if (isUniqueViolation(e, 'org_ownership_transfers_pending_uniq'))
        throw new OwnershipTransferPendingError()
      throw e
    }
  },

  /**
   * Отменить ожидающую передачу: ссылка сразу перестаёт работать. Повтор (или нечего отменять) —
   * `cancelled: false` без изменений.
   */
  async cancel(ctx: ServiceContext, orgId: number): Promise<{ cancelled: boolean }> {
    const now = new Date()
    return getDb(ctx).transaction(async (tx) => {
      await lockOwnedOrg(tx, ctx.userId, orgId)
      await expireDue(tx, orgId, now)
      const [cancelled] = await tx
        .update(organizationOwnershipTransfers)
        .set({ status: 'cancelled', resolvedAt: now })
        .where(
          and(
            eq(organizationOwnershipTransfers.organizationId, orgId),
            eq(organizationOwnershipTransfers.status, 'pending'),
          ),
        )
        .returning()
      if (!cancelled) return { cancelled: false }
      await auditService.record(
        { ...ctx, db: tx },
        {
          organizationId: orgId,
          action: AUDIT_ACTIONS.OWNERSHIP_TRANSFER_CANCELLED,
          entityType: 'ownership_transfer',
          entityId: cancelled.id,
          oldValue: { status: 'pending' },
          newValue: { status: 'cancelled', toUserId: cancelled.toUserId },
        },
      )
      return { cancelled: true }
    })
  },

  /**
   * Что показать на странице принятия. Ссылка другого пользователя и неизвестная ссылка
   * неотличимы (`invalid`, без группы и имён).
   */
  async preview(ctx: ServiceContext, token: unknown): Promise<TransferPreview> {
    const invalid: TransferPreview = {
      status: 'invalid',
      organization: null,
      fromName: null,
      expiresAt: null,
    }
    if (!isTransferTokenShape(token)) return invalid
    const [row] = await getDb(ctx)
      .select({
        transfer: organizationOwnershipTransfers,
        orgName: organizations.name,
        orgDeletedAt: organizations.deletedAt,
        fromName: users.name,
        fromUsername: users.telegramUsername,
      })
      .from(organizationOwnershipTransfers)
      .innerJoin(organizations, eq(organizations.id, organizationOwnershipTransfers.organizationId))
      .innerJoin(users, eq(users.id, organizationOwnershipTransfers.fromUserId))
      .where(eq(organizationOwnershipTransfers.tokenHash, hashTransferToken(token)))
    if (!row || row.transfer.toUserId !== ctx.userId || row.orgDeletedAt) return invalid
    const t = row.transfer
    const status: TransferPreviewStatus =
      t.status === 'pending' && t.expiresAt <= new Date()
        ? 'expired'
        : (t.status as TransferPreviewStatus)
    return {
      status,
      organization: { id: t.organizationId, name: row.orgName },
      fromName: displayName({ name: row.fromName, telegramUsername: row.fromUsername }),
      expiresAt: t.expiresAt,
    }
  },

  /**
   * Принять передачу по ссылке. В одной транзакции под `FOR UPDATE` группы и передачи: прежний
   * owner понижается до organizer, получатель становится owner, `organizations.owner_user_id`
   * меняется, передача закрывается; журнал — в той же транзакции. Истёкшая ссылка закрывается
   * как `expired` (это фиксируется) и отклоняется; отменённая, использованная, чужая — отклоняются
   * без изменений.
   */
  async accept(ctx: ServiceContext, token: unknown): Promise<{ organizationId: number }> {
    if (!isTransferTokenShape(token)) throw new OwnershipTransferInvalidError()
    const hash = hashTransferToken(token)
    const db = getDb(ctx)
    const [found] = await db
      .select({
        id: organizationOwnershipTransfers.id,
        organizationId: organizationOwnershipTransfers.organizationId,
        toUserId: organizationOwnershipTransfers.toUserId,
      })
      .from(organizationOwnershipTransfers)
      .where(eq(organizationOwnershipTransfers.tokenHash, hash))
    if (!found || found.toUserId !== ctx.userId) throw new OwnershipTransferInvalidError()

    const now = new Date()
    const outcome = await db.transaction(async (tx) => {
      // порядок блокировок как у старта, отмены и удаления: группа, затем передача
      const [org] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, found.organizationId))
        .for('update')
      const [t] = await tx
        .select()
        .from(organizationOwnershipTransfers)
        .where(eq(organizationOwnershipTransfers.id, found.id))
        .for('update')
      if (!org || !t) return new OwnershipTransferInvalidError()
      if (t.status === 'accepted') return new OwnershipTransferUsedError()
      if (t.status === 'cancelled') return new OwnershipTransferCancelledError()
      if (t.status === 'expired') return new OwnershipTransferExpiredError()
      if (t.expiresAt <= now) {
        await expireDue(tx, org.id, now)
        return new OwnershipTransferExpiredError()
      }
      // удалённая группа не принимает передач (удаление невозможно при ожидающей передаче)
      if (org.deletedAt) return new OwnershipTransferInvalidError()
      if (org.ownerUserId !== t.fromUserId) return new OwnershipTransferInvalidError()
      const [recipient] = await tx
        .select({ member: organizationMembers, isActive: users.isActive })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        .where(
          and(
            eq(organizationMembers.organizationId, org.id),
            eq(organizationMembers.userId, t.toUserId),
          ),
        )
      if (!recipient || recipient.member.status !== 'active' || !recipient.isActive)
        return new OwnershipTransferRecipientGoneError()

      // сначала понизить прежнего owner: уникальный индекс допускает одного owner на группу
      const [previous] = await tx
        .update(organizationMembers)
        .set({ role: 'organizer', updatedAt: now })
        .where(
          and(
            eq(organizationMembers.organizationId, org.id),
            eq(organizationMembers.userId, t.fromUserId),
            eq(organizationMembers.role, 'owner'),
          ),
        )
        .returning()
      if (!previous) return new OwnershipTransferInvalidError()
      const [next] = await tx
        .update(organizationMembers)
        .set({ role: 'owner', updatedAt: now })
        .where(eq(organizationMembers.id, recipient.member.id))
        .returning()
      await tx
        .update(organizations)
        .set({ ownerUserId: t.toUserId, updatedAt: now })
        .where(eq(organizations.id, org.id))
      await tx
        .update(organizationOwnershipTransfers)
        .set({ status: 'accepted', resolvedAt: now })
        .where(eq(organizationOwnershipTransfers.id, t.id))

      const txCtx = { ...ctx, db: tx }
      await auditService.record(txCtx, {
        organizationId: org.id,
        action: AUDIT_ACTIONS.OWNERSHIP_TRANSFER_ACCEPTED,
        entityType: 'ownership_transfer',
        entityId: t.id,
        oldValue: { ownerUserId: t.fromUserId },
        newValue: { ownerUserId: t.toUserId, previousOwnerRole: 'organizer' },
      })
      await auditService.record(txCtx, {
        organizationId: org.id,
        action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
        entityType: 'member',
        entityId: previous.id,
        oldValue: { role: 'owner' },
        newValue: { role: 'organizer' },
      })
      await auditService.record(txCtx, {
        organizationId: org.id,
        action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
        entityType: 'member',
        entityId: next!.id,
        oldValue: { role: recipient.member.role },
        newValue: { role: 'owner' },
      })
      return { organizationId: org.id }
    })
    if (outcome instanceof OrganizationLifecycleError) throw outcome
    return outcome
  },

  /**
   * Шаг планировщика: истёкшие ожидающие передачи → `expired` с записью в журнале. Принятие и
   * отмена тоже закрывают истёкшую передачу сами, поэтому без планировщика ссылка всё равно
   * перестаёт работать в срок.
   */
  async expireDue(now: Date = new Date(), db: DbOrTx = defaultDb): Promise<number> {
    return db.transaction((tx) => expireDue(tx, null, now))
  },
}

/**
 * Мягкое удаление группы (21.2.17, D-15). Удаление ставит `deleted_at` и `restore_until` и больше
 * ничего не меняет: события, записи, платежи, касса, баланс событий, абонементы, приглашения и
 * привязка Telegram-чата остаются как были. Блокирует доступ tenant middleware и фильтры фоновых
 * задач, бота и публичных страниц. Восстановление в окне снимает пометку — группа возвращается
 * в прежнее состояние без пересчёта денег. Окончательная очистка после окна здесь не реализована:
 * до неё нужно решение владельца о судьбе финансовых записей (карточка, п. 5).
 */
export const organizationDeletionService = {
  async delete(
    ctx: ServiceContext,
    orgId: number,
    input: DeleteOrganizationInput,
  ): Promise<{ deletedAt: Date; restoreUntil: Date }> {
    const data = DeleteOrganizationInput.parse(input)
    const now = new Date()
    return getDb(ctx).transaction(async (tx) => {
      const org = await lockOwnedOrg(tx, ctx.userId, orgId)
      if (org.deletedAt) throw new OrgDeletedError()
      if (org.status === 'archived') throw new OrganizationArchivedError()
      if (data.confirmName.trim() !== org.name.trim()) throw new DeleteConfirmationMismatchError()
      await expireDue(tx, orgId, now)
      if (await pendingOf(tx, orgId, now)) throw new DeleteBlockedByTransferError()
      const restoreUntil = new Date(now.getTime() + restoreWindowDays() * 86_400_000)
      await tx
        .update(organizations)
        .set({ deletedAt: now, restoreUntil })
        .where(eq(organizations.id, orgId))
      await auditService.record(
        { ...ctx, db: tx },
        {
          organizationId: orgId,
          action: AUDIT_ACTIONS.ORG_DELETED,
          entityType: 'organization',
          entityId: orgId,
          oldValue: { deletedAt: null },
          newValue: { deletedAt: now.toISOString(), restoreUntil: restoreUntil.toISOString() },
        },
      )
      return { deletedAt: now, restoreUntil }
    })
  },

  async restore(ctx: ServiceContext, orgId: number): Promise<{ restoredAt: Date }> {
    const now = new Date()
    return getDb(ctx).transaction(async (tx) => {
      const org = await lockOwnedOrg(tx, ctx.userId, orgId)
      if (!org.deletedAt || !org.restoreUntil) throw new OrganizationNotDeletedError()
      if (org.restoreUntil <= now) throw new RestoreWindowClosedError()
      await tx
        .update(organizations)
        .set({ deletedAt: null, restoreUntil: null })
        .where(eq(organizations.id, orgId))
      await auditService.record(
        { ...ctx, db: tx },
        {
          organizationId: orgId,
          action: AUDIT_ACTIONS.ORG_RESTORED,
          entityType: 'organization',
          entityId: orgId,
          oldValue: {
            deletedAt: org.deletedAt.toISOString(),
            restoreUntil: org.restoreUntil.toISOString(),
          },
          newValue: { deletedAt: null },
        },
      )
      return { restoredAt: now }
    })
  },

  /** Удалённые группы, которыми владеет пользователь (для списка «Мои группы» в вебе). */
  async listDeletedForOwner(ctx: ServiceContext): Promise<DeletedOrganizationView[]> {
    const now = new Date()
    const rows = await getDb(ctx)
      .select({
        id: organizations.id,
        name: organizations.name,
        deletedAt: organizations.deletedAt,
        restoreUntil: organizations.restoreUntil,
      })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, organizations.id),
          eq(organizationMembers.userId, ctx.userId),
          eq(organizationMembers.role, 'owner'),
          eq(organizationMembers.status, 'active'),
        ),
      )
      .where(and(eq(organizations.ownerUserId, ctx.userId), isNotNull(organizations.deletedAt)))
      .orderBy(organizations.name)
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      deletedAt: r.deletedAt!,
      restoreUntil: r.restoreUntil!,
      restorable: r.restoreUntil! > now,
    }))
  },
}
