/**
 * Журнал действий платформы для Root Admin (Task 22.1.2, `/api/platform/audit`).
 * Только чтение: изменить или удалить запись из интерфейса и API нельзя.
 */
export const PLATFORM_AUDIT_CATEGORIES = ['balance', 'plans', 'organizations', 'settings'] as const
export type PlatformAuditCategory = (typeof PLATFORM_AUDIT_CATEGORIES)[number]

export const PLATFORM_AUDIT_PERIODS = ['24h', '7d', '30d', 'all'] as const
export type PlatformAuditPeriod = (typeof PLATFORM_AUDIT_PERIODS)[number]

export interface PlatformAuditEntry {
  id: number
  createdAt: string
  action: string
  entityType: string
  entityId: number
  /** `null` — системное действие (планировщик, бот) или удалённый пользователь. */
  actor: { id: number; name: string; email: string | null } | null
  organization: { id: number; name: string } | null
  /** Значения до и после; поля с токенами и секретами заменены на `[скрыто]`. */
  oldValue: unknown
  newValue: unknown
}

export interface PlatformAuditPage {
  entries: PlatformAuditEntry[]
  /** id последней записи страницы для следующего запроса; `null` — записей больше нет. */
  nextCursor: number | null
  /** Сколько записей подходит под фильтры (без учёта курсора). */
  total: number
  /** Группы, у которых есть записи за выбранный период, для фильтра. */
  organizations: { id: number; name: string }[]
}
