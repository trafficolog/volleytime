import {
  and,
  appendEventBalanceEntry,
  auditLog,
  desc,
  eq,
  eventBalanceEntries,
  lockEventBalance,
  lt,
  organizations,
  sql,
  users,
} from '@volley-time/db'
import {
  PLATFORM_GRANT_CATEGORIES,
  PLATFORM_GRANT_COMMENT_MAX,
  PLATFORM_GRANT_COMMENT_MIN,
  PLATFORM_GRANT_MAX_UNITS,
  type PlatformGrantCategory,
  type PlatformGrantResult,
  type PlatformGrantsPage,
} from '@volley-time/shared'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { OrganizationNotFoundError } from '../organizations/errors'
import { assertRootAdmin } from '../permissions/root'
import { type ServiceContext, getDb, inTransaction } from '../shared/context'

import { PlatformGrantError } from './errors'

const INT4_MAX = 2_147_483_647
/** Источник записи в журнале и аудите: отличает начисление из Root Admin от операторской команды. */
const SOURCE = 'root-admin'

/**
 * Ручное начисление: организация, количество событий (1…1000), категория, обязательная причина
 * и ключ идемпотентности (UUID, один на открытие формы). `.strict()` — лишние поля отвергаются.
 */
const GrantInput = z
  .object({
    organizationId: z.number().int().positive().max(INT4_MAX),
    units: z.number().int().min(1).max(PLATFORM_GRANT_MAX_UNITS),
    category: z.enum(PLATFORM_GRANT_CATEGORIES).default('manual'),
    comment: z.string().trim().min(PLATFORM_GRANT_COMMENT_MIN).max(PLATFORM_GRANT_COMMENT_MAX),
    idempotencyKey: z.uuid(),
  })
  .strict()
export type PlatformGrantInput = z.input<typeof GrantInput>

const ListQuery = z.object({
  cursor: z.coerce.number().int().positive().max(INT4_MAX).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const isCategory = (v: unknown): v is PlatformGrantCategory =>
  (PLATFORM_GRANT_CATEGORIES as readonly unknown[]).includes(v)

/** Начисление баланса событий организации root-администратором (22.2.2, R-03). */
export const platformEventBalanceGrantsService = {
  /**
   * Начислить баланс: одна транзакция — блокировка проекции, запись журнала `grant` (автор root,
   * причина) и запись `audit_log`. Повтор отправки с тем же ключом под той же блокировкой возвращает
   * прежний результат (`replayed`) и баланс не меняет; тот же ключ с другими данными — 409.
   */
  async grant(ctx: ServiceContext, input: PlatformGrantInput): Promise<PlatformGrantResult> {
    await assertRootAdmin(ctx)
    const data = GrantInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const [org] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          deletedAt: organizations.deletedAt,
        })
        .from(organizations)
        .where(eq(organizations.id, data.organizationId))
      if (!org) throw new OrganizationNotFoundError(data.organizationId)
      // D-15: на время окна восстановления деньги группы не меняются
      if (org.deletedAt) {
        throw new PlatformGrantError('platform.grant_org_deleted', 'Организация удалена')
      }

      // блокировка проекции сериализует двойную отправку: вторая видит запись первой
      await lockEventBalance(db, org.id)
      const [prior] = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.action, AUDIT_ACTIONS.EVENT_BALANCE_GRANTED),
            eq(auditLog.userId, ctx.userId),
            sql`${auditLog.newValue}->>'idempotencyKey' = ${data.idempotencyKey}`,
          ),
        )
        .limit(1)
      if (prior) {
        const v = (prior.newValue ?? {}) as Record<string, unknown>
        if (
          prior.organizationId !== org.id ||
          v.delta !== data.units ||
          v.comment !== data.comment ||
          v.category !== data.category
        ) {
          throw new PlatformGrantError(
            'platform.grant_idempotency_conflict',
            'Этот ключ уже использован для другого начисления',
          )
        }
        const [entry] = await db
          .select()
          .from(eventBalanceEntries)
          .where(eq(eventBalanceEntries.id, prior.entityId!))
        return {
          entryId: entry!.id,
          organization: { id: org.id, name: org.name },
          delta: entry!.delta,
          balanceAfter: entry!.balanceAfter,
          category: data.category,
          comment: data.comment,
          createdAt: entry!.createdAt.toISOString(),
          replayed: true,
        }
      }

      const entry = await appendEventBalanceEntry(db, {
        organizationId: org.id,
        delta: data.units,
        reason: 'grant',
        actor: { kind: 'user', userId: ctx.userId },
        comment: data.comment,
      })
      await auditService.record(tx, {
        organizationId: org.id,
        action: AUDIT_ACTIONS.EVENT_BALANCE_GRANTED,
        entityType: 'event_balance_entry',
        entityId: entry.id,
        newValue: {
          delta: entry.delta,
          balanceAfter: entry.balanceAfter,
          category: data.category,
          comment: data.comment,
          idempotencyKey: data.idempotencyKey,
          source: SOURCE,
        },
      })
      return {
        entryId: entry.id,
        organization: { id: org.id, name: org.name },
        delta: entry.delta,
        balanceAfter: entry.balanceAfter,
        category: data.category,
        comment: data.comment,
        createdAt: entry.createdAt.toISOString(),
        replayed: false,
      }
    })
  },

  /** Ручные начисления всех организаций (журнал `grant`), новые сверху; keyset по `id`. */
  async list(
    ctx: ServiceContext,
    query: { cursor?: number | string; limit?: number | string } = {},
  ): Promise<PlatformGrantsPage> {
    await assertRootAdmin(ctx)
    const { cursor, limit } = ListQuery.parse(query)
    const rows = await getDb(ctx)
      .select({
        id: eventBalanceEntries.id,
        createdAt: eventBalanceEntries.createdAt,
        orgId: organizations.id,
        orgName: organizations.name,
        delta: eventBalanceEntries.delta,
        balanceAfter: eventBalanceEntries.balanceAfter,
        comment: eventBalanceEntries.comment,
        category: sql<string | null>`${auditLog.newValue}->>'category'`,
        actorId: users.id,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(eventBalanceEntries)
      .innerJoin(organizations, eq(organizations.id, eventBalanceEntries.organizationId))
      .leftJoin(users, eq(users.id, eventBalanceEntries.createdByUserId))
      .leftJoin(
        auditLog,
        and(
          eq(auditLog.entityType, 'event_balance_entry'),
          eq(auditLog.entityId, eventBalanceEntries.id),
          eq(auditLog.action, AUDIT_ACTIONS.EVENT_BALANCE_GRANTED),
        ),
      )
      .where(
        and(
          eq(eventBalanceEntries.reason, 'grant'),
          cursor === undefined ? undefined : lt(eventBalanceEntries.id, cursor),
        ),
      )
      .orderBy(desc(eventBalanceEntries.id))
      .limit(limit + 1)
    const page = rows.slice(0, limit)
    return {
      entries: page.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        organization: { id: r.orgId, name: r.orgName },
        delta: r.delta,
        balanceAfter: r.balanceAfter,
        category: isCategory(r.category) ? r.category : null,
        comment: r.comment,
        actor:
          r.actorId === null
            ? null
            : { id: r.actorId, name: r.actorName ?? '', email: r.actorEmail },
      })),
      nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
    }
  },
}
