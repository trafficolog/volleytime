import { and, auditLog, eq, type AuditLogEntry } from '@volley-time/db'

import { getDb, type ServiceContext } from '../shared/context'

import type { AuditAction, AuditEntityType } from './actions'

export interface LogParams {
  organizationId?: number
  action: AuditAction
  entityType: AuditEntityType
  entityId: number
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string
  userAgent?: string
}

export interface ListAuditParams {
  action?: string
  entityType?: string
  limit?: number
  offset?: number
}

export const auditService = {
  /**
   * Записать событие в audit-лог в текущей транзакции (ctx.db). Ошибка пробрасывается:
   * мутация и её audit-запись атомарны (Task 4.9.5).
   */
  async record(ctx: ServiceContext, params: LogParams): Promise<AuditLogEntry> {
    const [entry] = await getDb(ctx)
      .insert(auditLog)
      .values({
        organizationId: params.organizationId ?? null,
        userId: ctx.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      })
      .returning()
    return entry!
  },

  /** Best-effort запись вне транзакции (не бросает). Для мутаций использовать record. */
  async log(ctx: ServiceContext, params: LogParams): Promise<AuditLogEntry | null> {
    try {
      const [entry] = await getDb(ctx)
        .insert(auditLog)
        .values({
          organizationId: params.organizationId ?? null,
          userId: ctx.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValue: params.oldValue ?? null,
          newValue: params.newValue ?? null,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        })
        .returning()
      return entry ?? null
    } catch (e) {
      console.error('[audit] failed to log', e)
      return null
    }
  },

  /** Список записей организации с фильтрами. */
  async listByOrg(
    ctx: ServiceContext,
    orgId: number,
    filters: ListAuditParams = {},
  ): Promise<AuditLogEntry[]> {
    const db = getDb(ctx)
    const conds = [eq(auditLog.organizationId, orgId)]
    if (filters.action) conds.push(eq(auditLog.action, filters.action))
    if (filters.entityType) conds.push(eq(auditLog.entityType, filters.entityType))
    return db.query.auditLog.findMany({
      where: and(...conds),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
      limit: Math.min(filters.limit ?? 50, 200),
      offset: filters.offset ?? 0,
    })
  },
}
