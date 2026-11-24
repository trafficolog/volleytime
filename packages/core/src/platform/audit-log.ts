import {
  and,
  auditLog,
  desc,
  eq,
  gte,
  inArray,
  lt,
  notInArray,
  or,
  organizations,
  sql,
  users,
} from '@volley-time/db'
import type {
  PlatformRole,
  PlatformAuditCategory,
  PlatformAuditEntry,
  PlatformAuditPage,
  PlatformAuditPeriod,
} from '@volley-time/shared'

import { assertRootAdmin } from '../permissions/root'
import { type ServiceContext, getDb } from '../shared/context'

type SQL = ReturnType<typeof sql>

const HOUR_MS = 3_600_000
const PERIOD_MS: Record<Exclude<PlatformAuditPeriod, 'all'>, number> = {
  '24h': 24 * HOUR_MS,
  '7d': 7 * 24 * HOUR_MS,
  '30d': 30 * 24 * HOUR_MS,
}
const DEFAULT_PERIOD: PlatformAuditPeriod = '7d'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const MAX_ORGANIZATIONS = 200
const MAX_SEARCH_LENGTH = 100

/**
 * Разделы журнала (карточка 22.1.2: баланс, тарифы, организации, настройки) по имени действия:
 * точные действия и префиксы. Действие вне разделов видно только без фильтра по разделу.
 */
const SETTINGS_ACTIONS = [
  'organization.settings_updated',
  'organization.notifications_updated',
  'organization.payment_method_updated',
  'organization.logo_updated',
  'organization.logo_removed',
  'organization.short_link_updated',
]
const CATEGORY_PREFIXES: Record<PlatformAuditCategory, string[]> = {
  balance: ['event_balance.', 'event_balance_package.', 'ledger.', 'collection.'],
  plans: ['plan.', 'subscription.'],
  organizations: ['organization.', 'ownership_transfer.', 'member.', 'invite.'],
  settings: ['venue.', 'schedule_slot.', 'telegram_chat.', 'platform_setting.'],
}

/**
 * «Свои разделы» журнала по роли команды (29.3.1, R-15): Finance — баланс и тарифы, Moderator и
 * Support — пользователи и страницы групп (их разделы с записями журнала). Owner и Admin видят всё,
 * Analyst журнала не видит (политика `audit`).
 */
const ROLE_SCOPE: Partial<Record<PlatformRole, string[]>> = {
  finance: [...CATEGORY_PREFIXES.balance, ...CATEGORY_PREFIXES.plans],
  moderator: ['user.', 'group_page.'],
  support: ['user.', 'group_page.'],
}

const startsWith = (prefixes: string[]): SQL =>
  or(...prefixes.map((p) => sql`starts_with(${auditLog.action}, ${p})`))!

function categoryCondition(category: PlatformAuditCategory): SQL {
  if (category === 'settings') {
    return or(inArray(auditLog.action, SETTINGS_ACTIONS), startsWith(CATEGORY_PREFIXES.settings))!
  }
  if (category === 'organizations') {
    return and(
      startsWith(CATEGORY_PREFIXES.organizations),
      notInArray(auditLog.action, SETTINGS_ACTIONS),
    )!
  }
  return startsWith(CATEGORY_PREFIXES[category])
}

/** Ключи с токенами, секретами и ссылками-доступами: значение в журнал платформы не отдаётся. */
const SECRET_KEY = /token|secret|passw|hash|signature|api[_-]?key|code$|link|url/i
const REDACTED = '[скрыто]'
const MAX_DEPTH = 6
const MAX_ITEMS = 50
const MAX_STRING = 500

/** Копия значения аудита без секретов, с ограничением глубины и размера. */
export function redactAuditValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
  }
  if (depth >= MAX_DEPTH) return '…'
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((v) => redactAuditValue(v, depth + 1))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ITEMS)) {
      out[key] = SECRET_KEY.test(key) ? REDACTED : redactAuditValue(v, depth + 1)
    }
    return out
  }
  return undefined
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export interface PlatformAuditParams {
  period?: PlatformAuditPeriod
  organizationId?: number
  category?: PlatformAuditCategory
  q?: string
  /** id последней записи предыдущей страницы. */
  cursor?: number
  limit?: number
}

/**
 * Журнал действий платформы (Root Admin, 22.1.2): только чтение таблицы `audit_log` по всем
 * группам, новые записи сверху. Роль root проверяется здесь же, по базе, как второй рубеж после
 * `requireRootAdmin` в API. Журнал append-only: записать, изменить или удалить запись через этот
 * сервис нельзя. Токены и секреты в значениях скрыты; IP и user-agent не отдаются.
 */
export const platformAuditService = {
  async list(
    ctx: ServiceContext,
    params: PlatformAuditParams = {},
    now: Date = new Date(),
  ): Promise<PlatformAuditPage> {
    const role = await assertRootAdmin(ctx, 'audit')
    const db = getDb(ctx)
    const scope = ROLE_SCOPE[role]
    const scopeCond = scope ? startsWith(scope) : undefined

    const period = params.period ?? DEFAULT_PERIOD
    const limit = Math.min(Math.max(Math.trunc(params.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT)
    const periodCond =
      period === 'all'
        ? undefined
        : gte(auditLog.createdAt, new Date(now.getTime() - PERIOD_MS[period]))

    const filters: (SQL | undefined)[] = [periodCond, scopeCond]
    if (params.organizationId !== undefined) {
      filters.push(eq(auditLog.organizationId, params.organizationId))
    }
    if (params.category) filters.push(categoryCondition(params.category))
    const q = params.q?.trim().slice(0, MAX_SEARCH_LENGTH)
    if (q) {
      const pattern = `%${escapeLike(q)}%`
      filters.push(
        or(
          sql`${auditLog.action} ILIKE ${pattern}`,
          sql`${users.name} ILIKE ${pattern}`,
          sql`${users.email} ILIKE ${pattern}`,
        ),
      )
    }
    const where = and(...filters)
    const pageWhere =
      params.cursor === undefined ? where : and(where, lt(auditLog.id, params.cursor))

    const [rows, totals, orgRows] = await Promise.all([
      db
        .select({
          id: auditLog.id,
          createdAt: auditLog.createdAt,
          action: auditLog.action,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          oldValue: auditLog.oldValue,
          newValue: auditLog.newValue,
          actorId: users.id,
          actorName: users.name,
          actorEmail: users.email,
          orgId: organizations.id,
          orgName: organizations.name,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.userId))
        .leftJoin(organizations, eq(organizations.id, auditLog.organizationId))
        .where(pageWhere)
        .orderBy(desc(auditLog.id))
        .limit(limit + 1),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.userId))
        .where(where),
      db
        .selectDistinct({ id: organizations.id, name: organizations.name })
        .from(auditLog)
        .innerJoin(organizations, eq(organizations.id, auditLog.organizationId))
        .where(and(periodCond, scopeCond))
        .orderBy(organizations.name, organizations.id)
        .limit(MAX_ORGANIZATIONS),
    ])

    const hasMore = rows.length > limit
    const entries: PlatformAuditEntry[] = rows.slice(0, limit).map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actor:
        r.actorId === null ? null : { id: r.actorId, name: r.actorName ?? '', email: r.actorEmail },
      organization: r.orgId === null ? null : { id: r.orgId, name: r.orgName ?? '' },
      oldValue: redactAuditValue(r.oldValue),
      newValue: redactAuditValue(r.newValue),
    }))

    return {
      entries,
      nextCursor: hasMore ? entries[entries.length - 1]!.id : null,
      total: totals[0]?.n ?? 0,
      organizations: orgRows,
    }
  },
}
