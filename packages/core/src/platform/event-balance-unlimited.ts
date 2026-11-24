import { eq, organizations } from '@volley-time/db'
import {
  addIsoDays,
  hasControlChars,
  isValidIsoDate,
  NO_CONTROL_MESSAGE,
  minskToday,
  UNLIMITED_MAX_DAYS_AHEAD,
  UNLIMITED_REASON_MAX,
  UNLIMITED_REASON_MIN,
  unlimitedBoundary,
  unlimitedLastDay,
  type PlatformUnlimitedResult,
} from '@volley-time/shared'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { OrganizationError, OrganizationNotFoundError } from '../organizations/errors'
import { assertRootAdmin } from '../permissions/root'
import { type ServiceContext, getDb, inTransaction } from '../shared/context'

/** Группа удалена (мягко): безлимит не меняется на время окна восстановления (409). */
export class PlatformUnlimitedError extends OrganizationError {
  constructor() {
    super('organization.deleted', 'Организация удалена')
    this.name = 'PlatformUnlimitedError'
  }
}

/** Причина: 3–500 символов после `trim`, без управляющих символов (проверка до `trim`). */
const Reason = z
  .string()
  .refine((v) => !hasControlChars(v), NO_CONTROL_MESSAGE)
  .trim()
  .min(UNLIMITED_REASON_MIN)
  .max(UNLIMITED_REASON_MAX)

const SetInput = z
  .object({
    until: z.string().refine(isValidIsoDate, 'Ожидается дата YYYY-MM-DD'),
    reason: Reason,
  })
  .strict()
const CancelInput = z.object({ reason: Reason }).strict()

const result = (until: Date | null, now: Date): PlatformUnlimitedResult => ({
  until: until ? unlimitedLastDay(until) : null,
  active: until !== null && until > now,
})

/**
 * Безлимит событий отдельной группы до даты (22.3.1, ADR-22-3-1, D-20). Дата — последний день по
 * Минску включительно; в колонке хранится исключающая граница `D + 1` 00:00 Минска. Баланс и журнал
 * не меняются; кто и почему — в `audit_log` (организация — группа).
 */
export const platformEventBalanceUnlimitedService = {
  /** Включить или изменить дату. Повтор той же даты — без новой записи аудита. */
  async set(
    ctx: ServiceContext,
    orgId: number,
    input: unknown,
    now: Date = new Date(),
  ): Promise<PlatformUnlimitedResult> {
    await assertRootAdmin(ctx, 'balanceManage')
    const data = SetInput.parse(input)
    const today = minskToday(now)
    if (data.until < today || data.until > addIsoDays(today, UNLIMITED_MAX_DAYS_AHEAD)) {
      throw new z.ZodError([
        {
          code: 'custom',
          path: ['until'],
          message: `Дата — от сегодняшней (по Минску) до +${UNLIMITED_MAX_DAYS_AHEAD} дней`,
          input: data.until,
        },
      ])
    }
    const boundary = unlimitedBoundary(data.until)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const [org] = await db
        .select({
          id: organizations.id,
          deletedAt: organizations.deletedAt,
          until: organizations.eventBalanceUnlimitedUntil,
        })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .for('update')
      if (!org) throw new OrganizationNotFoundError(orgId)
      if (org.deletedAt) throw new PlatformUnlimitedError()
      if (org.until && org.until.getTime() === boundary.getTime()) return result(org.until, now)
      const wasActive = org.until !== null && org.until > now
      await db
        .update(organizations)
        .set({ eventBalanceUnlimitedUntil: boundary })
        .where(eq(organizations.id, orgId))
      await auditService.record(tx, {
        organizationId: orgId,
        action: wasActive
          ? AUDIT_ACTIONS.EVENT_BALANCE_UNLIMITED_CHANGED
          : AUDIT_ACTIONS.EVENT_BALANCE_UNLIMITED_SET,
        entityType: 'organization',
        entityId: orgId,
        oldValue: wasActive ? { until: unlimitedLastDay(org.until!) } : null,
        newValue: { until: data.until, reason: data.reason },
      })
      return result(boundary, now)
    })
  },

  /** Отключить безлимит. Без активного безлимита — без аудита (истёкшая дата просто снимается). */
  async cancel(
    ctx: ServiceContext,
    orgId: number,
    input: unknown,
    now: Date = new Date(),
  ): Promise<PlatformUnlimitedResult> {
    await assertRootAdmin(ctx, 'balanceManage')
    const data = CancelInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const [org] = await db
        .select({
          deletedAt: organizations.deletedAt,
          until: organizations.eventBalanceUnlimitedUntil,
        })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .for('update')
      if (!org) throw new OrganizationNotFoundError(orgId)
      if (org.deletedAt) throw new PlatformUnlimitedError()
      if (org.until === null) return { until: null, active: false }
      await db
        .update(organizations)
        .set({ eventBalanceUnlimitedUntil: null })
        .where(eq(organizations.id, orgId))
      if (org.until > now) {
        await auditService.record(tx, {
          organizationId: orgId,
          action: AUDIT_ACTIONS.EVENT_BALANCE_UNLIMITED_CANCELLED,
          entityType: 'organization',
          entityId: orgId,
          oldValue: { until: unlimitedLastDay(org.until) },
          newValue: { until: null, reason: data.reason },
        })
      }
      return { until: null, active: false }
    })
  },
}
