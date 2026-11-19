import {
  and,
  auditLog,
  bookings,
  desc,
  eq,
  eventBalanceEntries,
  events,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  organizationEventBalances,
  organizationMembers,
  organizations,
  sql,
  users,
} from '@volley-time/db'
import type {
  PlatformOrgOwner,
  PlatformOrganizationCreateResult,
  PlatformOrganizationDetail,
  PlatformOrganizationRow,
  PlatformOrganizationsCounts,
  PlatformOrganizationsPage,
  PlatformOrgSort,
  PlatformOrgStatusFilter,
} from '@volley-time/shared'
import { z } from 'zod'

import { EVENT_BALANCE_LOW_THRESHOLD } from '../event-balance/config'
import { OrganizationNotFoundError } from '../organizations/errors'
import { CreateOrganizationInput } from '../organizations/schemas'
import { organizationService } from '../organizations/service'
import { assertRootAdmin } from '../permissions/root'
import { type ServiceContext, getDb, inTransaction } from '../shared/context'

import { redactAuditValue } from './audit-log'
import { PlatformOwnerError } from './errors'

type Db = ReturnType<typeof getDb>

const DAY_MS = 86_400_000
const MONTH_DAYS = 30
const ACTIVE_DAYS = 7
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100
const MAX_SEARCH_LENGTH = 100
const AUDIT_DAYS = 7
const AUDIT_LIMIT = 10
const BALANCE_HISTORY_LIMIT = 5

/** Событие считается состоявшимся, если не черновик и не отменено — как в обзоре платформы. */
const EXCLUDED_EVENT_STATUSES = ['draft', 'cancelled'] as const

export interface PlatformOrganizationsParams {
  status?: PlatformOrgStatusFilter
  /** Только группы, у которых баланс заканчивается. */
  lowBalance?: boolean
  /** Только группы без активности последние 7 суток. */
  inactive?: boolean
  sort?: PlatformOrgSort
  q?: string
  page?: number
  pageSize?: number
}

const CreateInput = CreateOrganizationInput.pick({ name: true, slug: true, city: true }).extend({
  /** Владелец: `email` или `@telegram_username` существующего пользователя. */
  owner: z.string().trim().min(3).max(254),
})
export type PlatformOrganizationCreateInput = z.input<typeof CreateInput>

const TELEGRAM_USERNAME = /^@?[A-Za-z0-9_]{3,64}$/

interface Activity {
  eventsMonth: number
  lastActivityAt: Date | null
}

/**
 * Активность групп: состоявшиеся события за 30 суток и время последнего события или записи.
 * Событие — по времени начала (не позже `now`), запись — по времени создания.
 */
async function loadActivity(db: Db, orgIds: number[], now: Date): Promise<Map<number, Activity>> {
  const result = new Map<number, Activity>()
  if (orgIds.length === 0) return result
  const monthFrom = new Date(now.getTime() - MONTH_DAYS * DAY_MS)
  const [eventRows, bookingRows] = await Promise.all([
    db
      .select({
        orgId: events.organizationId,
        month: sql<number>`count(*) FILTER (WHERE ${events.startsAt} >= ${monthFrom.toISOString()}::timestamptz)::int`,
        last: sql<Date | null>`max(${events.startsAt})`,
      })
      .from(events)
      .where(
        and(
          inArray(events.organizationId, orgIds),
          notInArray(events.status, [...EXCLUDED_EVENT_STATUSES]),
          lte(events.startsAt, now),
        ),
      )
      .groupBy(events.organizationId),
    db
      .select({
        orgId: bookings.organizationId,
        last: sql<Date | null>`max(${bookings.createdAt})`,
      })
      .from(bookings)
      .where(and(inArray(bookings.organizationId, orgIds), lte(bookings.createdAt, now)))
      .groupBy(bookings.organizationId),
  ])
  for (const id of orgIds) result.set(id, { eventsMonth: 0, lastActivityAt: null })
  for (const r of eventRows) {
    result.set(r.orgId, { eventsMonth: r.month, lastActivityAt: toDate(r.last) })
  }
  for (const r of bookingRows) {
    const prev = result.get(r.orgId)!
    const last = toDate(r.last)
    if (last && (!prev.lastActivityAt || last > prev.lastActivityAt)) prev.lastActivityAt = last
  }
  return result
}

/** `max()` над timestamptz драйвер отдаёт строкой или датой. */
function toDate(value: Date | string | null): Date | null {
  if (value === null) return null
  return value instanceof Date ? value : new Date(value)
}

async function loadBalancesAndMembers(db: Db, orgIds: number[]) {
  if (orgIds.length === 0) return { balances: new Map<number, number>(), members: new Map() }
  const [balanceRows, memberRows] = await Promise.all([
    db
      .select({
        orgId: organizationEventBalances.organizationId,
        balance: organizationEventBalances.balance,
      })
      .from(organizationEventBalances)
      .where(inArray(organizationEventBalances.organizationId, orgIds)),
    db
      .select({ orgId: organizationMembers.organizationId, n: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(
        and(
          inArray(organizationMembers.organizationId, orgIds),
          eq(organizationMembers.status, 'active'),
        ),
      )
      .groupBy(organizationMembers.organizationId),
  ])
  return {
    balances: new Map(balanceRows.map((r) => [r.orgId, r.balance])),
    members: new Map(memberRows.map((r) => [r.orgId, r.n])),
  }
}

const ownerView = (u: {
  id: number | null
  name: string | null
  email: string | null
  telegramUsername: string | null
}): PlatformOrgOwner | null =>
  u.id === null
    ? null
    : { id: u.id, name: u.name ?? '', email: u.email, telegramUsername: u.telegramUsername }

const isLowBalance = (balance: number) => balance <= EVENT_BALANCE_LOW_THRESHOLD

/** Момент, от которого считается активность: последнее событие или запись, иначе создание группы. */
const activityAt = (createdAt: Date, activity: Activity): Date =>
  activity.lastActivityAt && activity.lastActivityAt > createdAt
    ? activity.lastActivityAt
    : createdAt

const isRecentlyActive = (at: Date, now: Date) =>
  now.getTime() - at.getTime() < ACTIVE_DAYS * DAY_MS

/**
 * Организации платформы (Root Admin, 22.1.3): список с фильтрами и поиском, карточка и ручное
 * создание. Роль root проверяется здесь же, по базе, как второй рубеж после `requireRootAdmin` в
 * API. Список читает все живые группы (не архивные и не удалённые) и считает показатели в
 * памяти: для платформы из сотен групп этого достаточно, постраничная выдача режет только ответ.
 */
export const platformOrganizationsService = {
  async list(
    ctx: ServiceContext,
    params: PlatformOrganizationsParams = {},
    now: Date = new Date(),
  ): Promise<PlatformOrganizationsPage> {
    await assertRootAdmin(ctx)
    const db = getDb(ctx)

    const rows = await db
      .select({
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
        city: organizations.city,
        status: organizations.status,
        createdAt: organizations.createdAt,
        ownerId: users.id,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerTelegram: users.telegramUsername,
      })
      .from(organizations)
      .leftJoin(users, eq(users.id, organizations.ownerUserId))
      .where(and(ne(organizations.status, 'archived'), isNull(organizations.deletedAt)))
    const ids = rows.map((r) => r.id)
    const [{ balances, members }, activity] = await Promise.all([
      loadBalancesAndMembers(db, ids),
      loadActivity(db, ids, now),
    ])

    const counts: PlatformOrganizationsCounts = { all: 0, active: 0, risk: 0, blocked: 0 }
    const all = rows.map((r) => {
      const act = activity.get(r.id) ?? { eventsMonth: 0, lastActivityAt: null }
      const balance = balances.get(r.id) ?? 0
      const lastActivity = activityAt(r.createdAt, act)
      const recentlyActive = isRecentlyActive(lastActivity, now)
      const blocked = r.status === 'suspended'
      const lowBalance = isLowBalance(balance)
      counts.all++
      if (blocked) counts.blocked++
      else {
        if (recentlyActive) counts.active++
        if (lowBalance || !recentlyActive) counts.risk++
      }
      const row: PlatformOrganizationRow = {
        id: r.id,
        slug: r.slug,
        name: r.name,
        city: r.city,
        status: blocked ? 'suspended' : 'active',
        owner: ownerView({
          id: r.ownerId,
          name: r.ownerName,
          email: r.ownerEmail,
          telegramUsername: r.ownerTelegram,
        }),
        balance,
        lowBalance,
        members: members.get(r.id) ?? 0,
        eventsMonth: act.eventsMonth,
        lastActivityAt: lastActivity.toISOString(),
        createdAt: r.createdAt.toISOString(),
      }
      return { row, recentlyActive }
    })

    const status = params.status ?? 'all'
    const q = params.q?.trim().slice(0, MAX_SEARCH_LENGTH).toLowerCase()
    const matches = all.filter(({ row, recentlyActive }) => {
      const blocked = row.status === 'suspended'
      if (status === 'active' && (blocked || !recentlyActive)) return false
      if (status === 'risk' && (blocked || !(row.lowBalance || !recentlyActive))) return false
      if (status === 'blocked' && !blocked) return false
      if (params.lowBalance && !row.lowBalance) return false
      if (params.inactive && recentlyActive) return false
      if (q) {
        const haystack = [
          row.name,
          row.slug,
          row.city,
          row.owner?.name,
          row.owner?.email,
          row.owner?.telegramUsername,
        ]
          .filter(Boolean)
          .join('\n')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    const byActivity = (a: PlatformOrganizationRow, b: PlatformOrganizationRow) =>
      b.lastActivityAt.localeCompare(a.lastActivityAt) || b.id - a.id
    matches.sort((a, b) =>
      params.sort === 'events'
        ? b.row.eventsMonth - a.row.eventsMonth || byActivity(a.row, b.row)
        : byActivity(a.row, b.row),
    )

    const pageSize = Math.min(
      Math.max(Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE), 1),
      MAX_PAGE_SIZE,
    )
    const page = Math.max(Math.trunc(params.page ?? 1), 1)
    return {
      items: matches.slice((page - 1) * pageSize, page * pageSize).map((m) => m.row),
      counts,
      total: matches.length,
      page,
      pageSize,
    }
  },

  async get(
    ctx: ServiceContext,
    orgId: number,
    now: Date = new Date(),
  ): Promise<PlatformOrganizationDetail> {
    await assertRootAdmin(ctx)
    const db = getDb(ctx)

    const [org] = await db
      .select({
        org: organizations,
        ownerId: users.id,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerTelegram: users.telegramUsername,
      })
      .from(organizations)
      .leftJoin(users, eq(users.id, organizations.ownerUserId))
      .where(eq(organizations.id, orgId))
    if (!org) throw new OrganizationNotFoundError(orgId)

    const auditFrom = new Date(now.getTime() - AUDIT_DAYS * DAY_MS)
    const [{ balances, members }, activity, auditRows, historyRows] = await Promise.all([
      loadBalancesAndMembers(db, [orgId]),
      loadActivity(db, [orgId], now),
      db
        .select({
          id: auditLog.id,
          createdAt: auditLog.createdAt,
          action: auditLog.action,
          newValue: auditLog.newValue,
          actorId: users.id,
          actorName: users.name,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.userId))
        .where(and(eq(auditLog.organizationId, orgId), gte(auditLog.createdAt, auditFrom)))
        .orderBy(desc(auditLog.id))
        .limit(AUDIT_LIMIT),
      db
        .select({
          id: eventBalanceEntries.id,
          createdAt: eventBalanceEntries.createdAt,
          delta: eventBalanceEntries.delta,
          balanceAfter: eventBalanceEntries.balanceAfter,
          reason: eventBalanceEntries.reason,
        })
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.organizationId, orgId))
        .orderBy(desc(eventBalanceEntries.createdAt), desc(eventBalanceEntries.id))
        .limit(BALANCE_HISTORY_LIMIT),
    ])

    const o = org.org
    const act = activity.get(orgId) ?? { eventsMonth: 0, lastActivityAt: null }
    const balance = balances.get(orgId) ?? 0
    return {
      id: o.id,
      slug: o.slug,
      name: o.name,
      description: o.description,
      city: o.city,
      timezone: o.defaultTimezone,
      currency: o.defaultCurrency,
      status: o.status,
      deletedAt: o.deletedAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
      owner: ownerView({
        id: org.ownerId,
        name: org.ownerName,
        email: org.ownerEmail,
        telegramUsername: org.ownerTelegram,
      }),
      modules: {
        subscriptions: o.subscriptionsEnabled,
        publicPage: o.publicPageEnabled,
        seoIndex: o.seoIndex,
      },
      stats: {
        balance,
        lowBalance: isLowBalance(balance),
        members: members.get(orgId) ?? 0,
        eventsMonth: act.eventsMonth,
        lastActivityAt: activityAt(o.createdAt, act).toISOString(),
      },
      recentAudit: auditRows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        action: r.action,
        actor: r.actorId === null ? null : { id: r.actorId, name: r.actorName ?? '' },
        newValue: redactAuditValue(r.newValue),
      })),
      balanceHistory: historyRows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        delta: r.delta,
        balanceAfter: r.balanceAfter,
        reason: r.reason,
      })),
    }
  },

  /**
   * Ручное создание группы для существующего пользователя (найденного по email или Telegram-имени).
   * Группа, членство владельца, демо-квота баланса и записи журнала (`organization.created` с
   * автором root) пишутся в одной транзакции. Приглашение несуществующего пользователя не входит
   * в карточку: владелец должен уже быть в системе.
   */
  async create(
    ctx: ServiceContext,
    input: PlatformOrganizationCreateInput,
  ): Promise<PlatformOrganizationCreateResult> {
    await assertRootAdmin(ctx)
    const { owner, ...data } = CreateInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const ownerId = await resolveOwner(getDb(tx), owner)
      const org = await organizationService.createForOwner(tx, ownerId, data, {
        createdByRoot: true,
      })
      return { id: org.id, slug: org.slug, name: org.name }
    })
  },
}

/** Владелец по email (регистр не важен) или Telegram-имени (`@name` либо `name`). */
async function resolveOwner(db: Db, raw: string): Promise<number> {
  const byTelegram = raw.startsWith('@') || !raw.includes('@')
  if (byTelegram && !TELEGRAM_USERNAME.test(raw)) {
    throw new PlatformOwnerError('platform.owner_not_found', 'Владелец не найден')
  }
  const needle = (byTelegram ? raw.replace(/^@/, '') : raw).toLowerCase()
  const column = byTelegram ? users.telegramUsername : users.email
  const found = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(sql`lower(${column}) = ${needle}`)
    .limit(2)
  if (found.length === 0) {
    throw new PlatformOwnerError('platform.owner_not_found', 'Владелец не найден')
  }
  if (found.length > 1) {
    throw new PlatformOwnerError(
      'platform.owner_ambiguous',
      'Под это имя подходит несколько пользователей: укажите email',
    )
  }
  if (!found[0]!.isActive) {
    throw new PlatformOwnerError('platform.owner_inactive', 'Пользователь отключён')
  }
  return found[0]!.id
}
