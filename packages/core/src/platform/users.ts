import {
  and,
  auditLog,
  desc,
  eq,
  organizationMembers,
  organizations,
  sessions,
  sql,
  users,
} from '@volley-time/db'
import type {
  PlatformUserBlockResult,
  PlatformUserDetail,
  PlatformUserMembership,
  PlatformUserRow,
  PlatformUsersCounts,
  PlatformUsersPage,
  PlatformUserStatusFilter,
  PlatformUserTopRole,
} from '@volley-time/shared'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { assertRootAdmin } from '../permissions/root'
import { type ServiceContext, getDb, inTransaction } from '../shared/context'

import { PlatformUserError } from './errors'

type SQL = ReturnType<typeof sql>

const DAY_MS = 86_400_000
const ACTIVE_DAYS = 7
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100
const MAX_SEARCH_LENGTH = 100
const AUDIT_LIMIT = 10
/** `usr_42` или `42`: поиск по номеру пользователя, как в макете (`usr_…`). */
const USER_ID_QUERY = /^(?:usr_)?(\d{1,9})$/i

export interface PlatformUsersParams {
  status?: PlatformUserStatusFilter
  q?: string
  page?: number
  pageSize?: number
}

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value))

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Активные членства пользователя. */
const GROUPS: SQL = sql`(SELECT count(*)::int FROM ${organizationMembers} m
  WHERE m.user_id = ${users.id} AND m.status = 'active')`
/** Старшая роль среди активных членств. */
const TOP_ROLE: SQL = sql`(SELECT m.role FROM ${organizationMembers} m
  WHERE m.user_id = ${users.id} AND m.status = 'active'
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'organizer' THEN 1 WHEN 'assistant' THEN 2 ELSE 3 END
  LIMIT 1)`
const HAS_PENDING: SQL = sql`EXISTS (SELECT 1 FROM ${organizationMembers} m
  WHERE m.user_id = ${users.id} AND m.status = 'pending')`
/** Записи на события без отменённых. */
const BOOKINGS: SQL = sql`(SELECT count(*)::int FROM bookings b
  WHERE b.user_id = ${users.id} AND b.status <> 'cancelled')`
/** Последняя запись, обновление сессии или регистрация. */
const LAST_ACTIVITY: SQL = sql`GREATEST(
  ${users.createdAt},
  COALESCE((SELECT max(b.created_at) FROM bookings b WHERE b.user_id = ${users.id}), ${users.createdAt}),
  COALESCE((SELECT max(s.updated_at) FROM ${sessions} s WHERE s.user_id = ${users.id}), ${users.createdAt})
)`

const rowColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  telegramUsername: users.telegramUsername,
  telegramLinked: sql<boolean>`${users.telegramUserId} IS NOT NULL`,
  isActive: users.isActive,
  isRootAdmin: users.isRootAdmin,
  createdAt: users.createdAt,
  groups: sql<number>`${GROUPS}`,
  topRole: sql<PlatformUserTopRole | null>`${TOP_ROLE}`,
  hasPending: sql<boolean>`${HAS_PENDING}`,
  bookings: sql<number>`${BOOKINGS}`,
  lastActivity: sql<Date | string>`${LAST_ACTIVITY}`,
}

function toRow(r: {
  id: number
  name: string | null
  email: string | null
  telegramUsername: string | null
  telegramLinked: boolean
  isActive: boolean
  isRootAdmin: boolean
  createdAt: Date
  groups: number
  topRole: PlatformUserTopRole | null
  hasPending: boolean
  bookings: number
  lastActivity: Date | string
}): PlatformUserRow {
  return {
    id: r.id,
    name: r.name ?? '',
    email: r.email,
    telegramUsername: r.telegramUsername,
    telegramLinked: r.telegramLinked,
    groups: r.groups,
    topRole: r.topRole ?? (r.hasPending ? 'pending' : null),
    bookings: r.bookings,
    lastActivityAt: toDate(r.lastActivity).toISOString(),
    createdAt: r.createdAt.toISOString(),
    blocked: !r.isActive,
    isRootAdmin: r.isRootAdmin,
  }
}

/**
 * Пользователи платформы (Root Admin, 22.1.4): список с поиском и пагинацией в SQL, карточка,
 * блокировка и разблокировка. Роль root проверяется здесь же, по базе, как второй рубеж после
 * `requireRootAdmin` в API. Наружу уходят только имя, email, Telegram-имя и показатели:
 * телефон, числовой Telegram id и данные сессий не отдаются.
 *
 * Блокировка — `users.is_active = false`: флаг уже читает бот (`userByTelegramId`), а вход и
 * каждый запрос по сессии его проверяют (`packages/auth`, `requireAuth`). Все сессии
 * пользователя закрываются в той же транзакции, что и флаг, и запись журнала.
 */
export const platformUsersService = {
  async list(
    ctx: ServiceContext,
    params: PlatformUsersParams = {},
    now: Date = new Date(),
  ): Promise<PlatformUsersPage> {
    await assertRootAdmin(ctx)
    const db = getDb(ctx)
    const since = new Date(now.getTime() - ACTIVE_DAYS * DAY_MS).toISOString()

    const filters: (SQL | undefined)[] = []
    const status = params.status ?? 'all'
    if (status === 'blocked') filters.push(sql`NOT ${users.isActive}`)
    if (status === 'active') {
      filters.push(sql`${users.isActive} AND ${LAST_ACTIVITY} >= ${since}::timestamptz`)
    }
    const q = params.q?.trim().slice(0, MAX_SEARCH_LENGTH)
    if (q) {
      const pattern = `%${escapeLike(q)}%`
      const telegram = `%${escapeLike(q.replace(/^@/, ''))}%`
      const byId = USER_ID_QUERY.exec(q)
      filters.push(
        sql`(${users.name} ILIKE ${pattern} OR ${users.email} ILIKE ${pattern}
          OR ${users.telegramUsername} ILIKE ${telegram}
          ${byId ? sql`OR ${users.id} = ${Number(byId[1])}` : sql``})`,
      )
    }
    const where = and(...filters)

    const pageSize = Math.min(
      Math.max(Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE), 1),
      MAX_PAGE_SIZE,
    )
    const page = Math.max(Math.trunc(params.page ?? 1), 1)

    const [rows, totals, counted] = await Promise.all([
      db
        .select(rowColumns)
        .from(users)
        .where(where)
        .orderBy(sql`${LAST_ACTIVITY} DESC`, desc(users.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(where),
      db
        .select({
          all: sql<number>`count(*)::int`,
          telegram: sql<number>`count(*) FILTER (WHERE ${users.telegramUserId} IS NOT NULL)::int`,
          email: sql<number>`count(*) FILTER (WHERE ${users.email} IS NOT NULL)::int`,
          active: sql<number>`count(*) FILTER (WHERE ${users.isActive}
            AND ${LAST_ACTIVITY} >= ${since}::timestamptz)::int`,
          blocked: sql<number>`count(*) FILTER (WHERE NOT ${users.isActive})::int`,
          newThisWeek: sql<number>`count(*) FILTER (WHERE ${users.createdAt} >= ${since}::timestamptz)::int`,
        })
        .from(users),
    ])

    const counts: PlatformUsersCounts = counted[0] ?? {
      all: 0,
      telegram: 0,
      email: 0,
      active: 0,
      blocked: 0,
      newThisWeek: 0,
    }
    return { items: rows.map(toRow), counts, total: totals[0]?.n ?? 0, page, pageSize }
  },

  async get(ctx: ServiceContext, userId: number): Promise<PlatformUserDetail> {
    await assertRootAdmin(ctx)
    const db = getDb(ctx)

    const [row] = await db.select(rowColumns).from(users).where(eq(users.id, userId))
    if (!row) throw notFound(userId)

    const [memberships, auditRows] = await Promise.all([
      db
        .select({
          organizationId: organizations.id,
          organizationName: organizations.name,
          organizationSlug: organizations.slug,
          role: organizationMembers.role,
          status: organizationMembers.status,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
        .where(eq(organizationMembers.userId, userId))
        .orderBy(organizations.name, organizations.id),
      db
        .select({
          id: auditLog.id,
          createdAt: auditLog.createdAt,
          action: auditLog.action,
          actorId: users.id,
          actorName: users.name,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.userId))
        .where(and(eq(auditLog.entityType, 'user'), eq(auditLog.entityId, userId)))
        .orderBy(desc(auditLog.id))
        .limit(AUDIT_LIMIT),
    ])

    return {
      ...toRow(row),
      memberships: memberships as PlatformUserMembership[],
      recentAudit: auditRows.map((a) => ({
        id: a.id,
        createdAt: a.createdAt.toISOString(),
        action: a.action,
        actor: a.actorId === null ? null : { id: a.actorId, name: a.actorName ?? '' },
      })),
    }
  },

  /**
   * Блокировка: флаг, закрытие всех сессий и запись журнала (автор — root) — одна транзакция.
   * Нельзя заблокировать себя и другого root: снять роль root может только оператор базы, после
   * этого пользователь блокируется как обычный. Повторная блокировка — ошибка без записи.
   */
  async block(ctx: ServiceContext, userId: number): Promise<PlatformUserBlockResult> {
    await assertRootAdmin(ctx)
    if (userId === ctx.userId) {
      throw new PlatformUserError(
        'platform.user_cannot_block_self',
        'Нельзя заблокировать самого себя',
      )
    }
    return inTransaction(ctx, async (tx) => {
      const target = await lockUser(tx, userId)
      if (target.isRootAdmin) {
        throw new PlatformUserError(
          'platform.user_cannot_block_root',
          'Нельзя заблокировать администратора платформы',
        )
      }
      if (!target.isActive) {
        throw new PlatformUserError(
          'platform.user_already_blocked',
          'Пользователь уже заблокирован',
        )
      }
      const db = getDb(tx)
      await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, userId))
      await db.delete(sessions).where(eq(sessions.userId, userId))
      await auditService.record(tx, {
        action: AUDIT_ACTIONS.USER_BLOCKED,
        entityType: 'user',
        entityId: userId,
        oldValue: { isActive: true },
        newValue: { isActive: false },
      })
      return { id: userId, blocked: true }
    })
  },

  /** Разблокировка: флаг и запись журнала в одной транзакции; закрытые сессии не восстанавливаются. */
  async unblock(ctx: ServiceContext, userId: number): Promise<PlatformUserBlockResult> {
    await assertRootAdmin(ctx)
    return inTransaction(ctx, async (tx) => {
      const target = await lockUser(tx, userId)
      if (target.isActive) {
        throw new PlatformUserError('platform.user_not_blocked', 'Пользователь не заблокирован')
      }
      await getDb(tx)
        .update(users)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(users.id, userId))
      await auditService.record(tx, {
        action: AUDIT_ACTIONS.USER_UNBLOCKED,
        entityType: 'user',
        entityId: userId,
        oldValue: { isActive: false },
        newValue: { isActive: true },
      })
      return { id: userId, blocked: false }
    })
  },
}

const notFound = (userId: number) =>
  new PlatformUserError('platform.user_not_found', `User ${userId} not found`)

/** Строка пользователя под блокировкой: два параллельных запроса не запишут два события. */
async function lockUser(ctx: ServiceContext, userId: number) {
  const [target] = await getDb(ctx)
    .select({ id: users.id, isActive: users.isActive, isRootAdmin: users.isRootAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .for('update')
  if (!target) throw notFound(userId)
  return target
}
