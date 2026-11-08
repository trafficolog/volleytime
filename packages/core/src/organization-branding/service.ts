import { and, eq, ne, organizationLogos, organizations } from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { OrganizationArchivedError, OrganizationNotFoundError } from '../organizations/errors'
import { actorUserId, getDb, inTransaction, type ServiceContext } from '../shared/context'

import {
  LogoNotFoundError,
  ShortLinkInvalidError,
  ShortLinkReservedError,
  ShortLinkTakenError,
} from './errors'
import { validateLogoUpload, type LogoMimeType } from './logo'
import { isReservedShortLink } from './reserved'
import { SetShortLinkInput } from './short-link'

/** Логотип для отдачи: байты, тип по содержимому и версия (время загрузки). */
export interface LogoFile {
  data: Buffer
  mimeType: LogoMimeType
  sizeBytes: number
  updatedAt: Date
}

/** Нарушение уникального индекса короткой ссылки (гонка двух групп на один адрес). */
function isShortLinkUniqueViolation(error: unknown): boolean {
  for (let e = error as { code?: string; message?: string; cause?: unknown } | undefined; e;) {
    if (e.code === '23505' && /organizations_short_link_uniq/.test(e.message ?? '')) return true
    e = e.cause as typeof e
  }
  return false
}

async function lockActiveOrg(ctx: ServiceContext, orgId: number) {
  const [org] = await getDb(ctx)
    .select({
      id: organizations.id,
      status: organizations.status,
      shortLink: organizations.shortLink,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .for('update')
  if (!org) throw new OrganizationNotFoundError(orgId)
  if (org.status === 'archived') throw new OrganizationArchivedError()
  return org
}

export const organizationBrandingService = {
  /** Логотип группы или `LogoNotFoundError`. Доступ (участник группы) проверяет вызывающий. */
  async getLogo(ctx: ServiceContext, orgId: number): Promise<LogoFile> {
    const [row] = await getDb(ctx)
      .select({
        data: organizationLogos.data,
        mimeType: organizationLogos.mimeType,
        sizeBytes: organizationLogos.sizeBytes,
        updatedAt: organizationLogos.updatedAt,
      })
      .from(organizationLogos)
      .where(eq(organizationLogos.organizationId, orgId))
    if (!row) throw new LogoNotFoundError()
    return { ...row, mimeType: row.mimeType as LogoMimeType }
  },

  /**
   * Загрузить или заменить логотип (одна строка на группу). Тип, размер и содержимое проверяются
   * до записи (`validateLogoUpload`); байты в audit не пишутся — только тип и размер.
   */
  async setLogo(
    ctx: ServiceContext,
    orgId: number,
    input: { declaredType: string | undefined; data: Uint8Array },
  ): Promise<{ logoUpdatedAt: Date; mimeType: LogoMimeType; sizeBytes: number }> {
    const mimeType = validateLogoUpload(input)
    const data = Buffer.from(input.data)
    const now = new Date()
    return inTransaction(ctx, async (tx) => {
      await lockActiveOrg(tx, orgId)
      const db = getDb(tx)
      const [existing] = await db
        .select({ mimeType: organizationLogos.mimeType, sizeBytes: organizationLogos.sizeBytes })
        .from(organizationLogos)
        .where(eq(organizationLogos.organizationId, orgId))
      await db
        .insert(organizationLogos)
        .values({
          organizationId: orgId,
          data,
          mimeType,
          sizeBytes: data.length,
          updatedByUserId: actorUserId(ctx),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: organizationLogos.organizationId,
          set: {
            data,
            mimeType,
            sizeBytes: data.length,
            updatedByUserId: actorUserId(ctx),
            updatedAt: now,
          },
        })
      await db
        .update(organizations)
        .set({ logoUpdatedAt: now, updatedAt: now })
        .where(eq(organizations.id, orgId))
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.ORG_LOGO_UPDATED,
        entityType: 'organization',
        entityId: orgId,
        oldValue: existing ?? null,
        newValue: { mimeType, sizeBytes: data.length },
      })
      return { logoUpdatedAt: now, mimeType, sizeBytes: data.length }
    })
  },

  /** Удалить логотип; без логотипа — `LogoNotFoundError`. */
  async removeLogo(ctx: ServiceContext, orgId: number): Promise<void> {
    await inTransaction(ctx, async (tx) => {
      await lockActiveOrg(tx, orgId)
      const db = getDb(tx)
      const [removed] = await db
        .delete(organizationLogos)
        .where(eq(organizationLogos.organizationId, orgId))
        .returning({
          mimeType: organizationLogos.mimeType,
          sizeBytes: organizationLogos.sizeBytes,
        })
      if (!removed) throw new LogoNotFoundError()
      await db
        .update(organizations)
        .set({ logoUpdatedAt: null, updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.ORG_LOGO_REMOVED,
        entityType: 'organization',
        entityId: orgId,
        oldValue: removed,
        newValue: null,
      })
    })
  },

  /**
   * Задать или снять (`null`) короткую ссылку группы. Формат и регистр — `SetShortLinkInput`
   * (хранится строчными), зарезервированные слова отклоняются, занятый адрес — `ShortLinkTakenError`.
   * Гонку двух групп решает уникальный индекс: побеждает одна. Публичную страницу по адресу
   * строит 24.1.2.
   */
  async setShortLink(
    ctx: ServiceContext,
    orgId: number,
    input: SetShortLinkInput,
  ): Promise<{ shortLink: string | null }> {
    const parsed = SetShortLinkInput.safeParse(input)
    if (!parsed.success) {
      throw new ShortLinkInvalidError(parsed.error.issues[0]?.message ?? 'Invalid short link')
    }
    const value = parsed.data.shortLink
    if (value !== null && isReservedShortLink(value)) throw new ShortLinkReservedError(value)
    try {
      return await inTransaction(ctx, async (tx) => {
        const org = await lockActiveOrg(tx, orgId)
        if (org.shortLink === value) return { shortLink: value }
        const db = getDb(tx)
        if (value !== null) {
          const [other] = await db
            .select({ id: organizations.id })
            .from(organizations)
            .where(and(eq(organizations.shortLink, value), ne(organizations.id, orgId)))
          if (other) throw new ShortLinkTakenError(value)
        }
        await db
          .update(organizations)
          .set({ shortLink: value, updatedAt: new Date() })
          .where(eq(organizations.id, orgId))
        await auditService.record(tx, {
          organizationId: orgId,
          action: AUDIT_ACTIONS.ORG_SHORT_LINK_UPDATED,
          entityType: 'organization',
          entityId: orgId,
          oldValue: { shortLink: org.shortLink },
          newValue: { shortLink: value },
        })
        return { shortLink: value }
      })
    } catch (error) {
      if (value !== null && isShortLinkUniqueViolation(error)) throw new ShortLinkTakenError(value)
      throw error
    }
  },
}
