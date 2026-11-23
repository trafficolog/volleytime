import {
  and,
  asc,
  auditLog,
  desc,
  eq,
  groupPageComplaints,
  groupPageComplaintThrottle,
  groupPageModeration,
  gte,
  inArray,
  isNull,
  or,
  organizationMembers,
  organizations,
  sql,
  users,
  type DbOrTx,
  type GroupPageModeration,
} from '@volley-time/db'
import {
  GROUP_PAGE_CITY_REGIONS,
  GROUP_PAGE_COMPLAINT_DETAILS_MAX,
  GROUP_PAGE_COMPLAINT_REASON_CODES,
  GROUP_PAGE_COMPLAINTS_PER_DAY,
  GROUP_PAGE_MODERATION_NOTE_MAX,
  GROUP_PAGE_MODERATION_REASON_CODES,
  groupPageComplaintReasonTitle,
  groupPageModerationReasonTitle,
  moderationCityKey,
  type GroupPageComplaintReason,
  type GroupPageComplaintResolution,
  type GroupPageComplaintStatus,
  type GroupPageModerationReason,
  type GroupPageModerationState,
  type GroupPageModerationView,
  type GroupPagePublicState,
  type PlatformGroupPageCities,
  type PlatformGroupPageCity,
  type PlatformGroupPageComplaints,
  type PlatformGroupPageHistory,
  type PlatformGroupPageHistoryEntry,
  type PlatformGroupPageRow,
  type PlatformGroupPagesList,
} from '@volley-time/shared'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { collectNotification } from '../notifier/collect'
import type { NotificationType } from '../notifier/templates'
import { OrganizationNotFoundError } from '../organizations/errors'
import { assertRootAdmin } from '../permissions/root'
import { getDb, inTransaction, systemContext, type ServiceContext } from '../shared/context'

import {
  GroupPageComplaintClosedError,
  GroupPageComplaintLimitError,
  GroupPageComplaintNotFoundError,
  GroupPageModerationConflictError,
  GroupPageNotFoundError,
} from './errors'
import { GROUP_SLUG_RE } from './public'

const INT4_MAX = 2_147_483_647
const DAY_MS = 86_400_000

/** Решение root для владельца и организаторов: без автора (24.1.3). */
export function moderationView(
  row: GroupPageModeration | undefined,
): GroupPageModerationView | null {
  if (!row) return null
  return {
    state: row.state as GroupPageModerationState,
    reasonCode: row.reasonCode as GroupPageModerationReason,
    reasonTitle: groupPageModerationReasonTitle(row.reasonCode),
    note: row.note,
    decidedAt: row.updatedAt.toISOString(),
  }
}

export async function readModeration(
  db: DbOrTx,
  organizationId: number,
): Promise<GroupPageModeration | undefined> {
  const [row] = await db
    .select()
    .from(groupPageModeration)
    .where(eq(groupPageModeration.organizationId, organizationId))
  return row
}

const pageState = (seoIndex: boolean, mod: string | null): GroupPagePublicState =>
  mod === 'hidden' || mod === 'noindex' ? mod : seoIndex ? 'index' : 'own'

/**
 * Страницы групп для Root Admin: группа активна и не удалена, и либо владелец опубликовал
 * страницу, либо на ней действует решение root (скрытая страница не теряется из списка).
 */
const moderatedPage = and(
  eq(organizations.status, 'active'),
  isNull(organizations.deletedAt),
  or(
    eq(organizations.publicPageEnabled, true),
    sql`EXISTS (SELECT 1 FROM ${groupPageModeration} m WHERE m.organization_id = ${organizations.id})`,
  ),
)

async function pageRows(db: DbOrTx, where = moderatedPage): Promise<PlatformGroupPageRow[]> {
  const rows = await db
    .select({
      organizationId: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      city: organizations.city,
      seoIndex: organizations.seoIndex,
      updatedAt: organizations.updatedAt,
      modState: groupPageModeration.state,
      modReason: groupPageModeration.reasonCode,
      modNote: groupPageModeration.note,
      modAt: groupPageModeration.updatedAt,
      actorId: users.id,
      actorName: users.name,
      actorEmail: users.email,
      newComplaints: sql<number>`(SELECT count(*)::int FROM ${groupPageComplaints} c
        WHERE c.organization_id = ${organizations.id} AND c.status = 'new')`,
    })
    .from(organizations)
    .leftJoin(groupPageModeration, eq(groupPageModeration.organizationId, organizations.id))
    .leftJoin(users, eq(users.id, groupPageModeration.actorUserId))
    .where(where)
    .orderBy(asc(organizations.name), asc(organizations.id))
  return rows.map((r) => ({
    organizationId: r.organizationId,
    name: r.name,
    slug: r.slug,
    city: r.city,
    state: pageState(r.seoIndex, r.modState),
    moderation:
      r.modState && r.modReason && r.modAt
        ? {
            reasonCode: r.modReason as GroupPageModerationReason,
            reasonTitle: groupPageModerationReasonTitle(r.modReason),
            note: r.modNote,
            decidedBy:
              r.actorId === null
                ? null
                : { id: r.actorId, name: r.actorName || r.actorEmail || '' },
            decidedAt: r.modAt.toISOString(),
          }
        : null,
    newComplaints: r.newComplaints,
    updatedAt: r.updatedAt.toISOString(),
  }))
}

const emptyCity = (name: string): PlatformGroupPageCity => ({
  name,
  pages: 0,
  indexed: 0,
  noindex: 0,
  hidden: 0,
  issues: 0,
})

function addPage(c: PlatformGroupPageCity, p: PlatformGroupPageRow): void {
  c.pages += 1
  if (p.state === 'index') c.indexed += 1
  if (p.state === 'noindex') c.noindex += 1
  if (p.state === 'hidden') c.hidden += 1
  if (p.state === 'noindex' || p.state === 'hidden' || p.newComplaints > 0) c.issues += 1
}

export const ListGroupPagesQuery = z.object({
  /** Город справочника или произвольный город группы; не задан — вся страна. */
  city: z.string().trim().min(1).max(100).optional(),
  filter: z.enum(['all', 'moderated', 'complaints']).default('all'),
  /** Поиск по названию группы или slug (от 2 символов). */
  q: z.string().trim().min(2).max(100).optional(),
})

const ActInput = z
  .object({
    state: z.enum(['hidden', 'noindex']),
    reasonCode: z.enum(GROUP_PAGE_MODERATION_REASON_CODES),
    note: z
      .string()
      .trim()
      .max(GROUP_PAGE_MODERATION_NOTE_MAX)
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .strict()
export type GroupPageModerationInput = z.input<typeof ActInput>

const ComplaintsQuery = z.object({
  status: z.enum(['new', 'closed', 'all']).default('new'),
})

const ComplaintInput = z
  .object({
    reasonCode: z.enum(GROUP_PAGE_COMPLAINT_REASON_CODES),
    details: z
      .string()
      .trim()
      .max(GROUP_PAGE_COMPLAINT_DETAILS_MAX)
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .strict()
export type GroupPageComplaintInput = z.input<typeof ComplaintInput>

/** Строка группы под блокировкой: параллельные решения по одной странице сериализованы. */
async function lockOrg(db: DbOrTx, orgId: number) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .for('update')
  if (!org || org.deletedAt) throw new OrganizationNotFoundError(orgId)
  return org
}

const NOTIFY_TYPE: Record<GroupPageModerationState | 'restored', NotificationType> = {
  hidden: 'group_page_hidden',
  noindex: 'group_page_noindex',
  restored: 'group_page_restored',
}

/**
 * Уведомление владельцу и организаторам группы (лента и бот через журнал `scheduled_jobs`, тип
 * ленты `organizer_action_required`, вид — тип шаблона). Ключ — запись аудита: каждое решение —
 * отдельное сообщение. Автор решения не передаётся.
 */
async function notifyManagers(
  ctx: ServiceContext,
  db: DbOrTx,
  org: { id: number; name: string },
  kind: GroupPageModerationState | 'restored',
  auditId: number,
  reason: { code: string; note: string | null } | null,
): Promise<void> {
  const managers = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, org.id),
        eq(organizationMembers.status, 'active'),
        inArray(organizationMembers.role, ['owner', 'organizer']),
      ),
    )
    .orderBy(asc(organizationMembers.userId))
  const type = NOTIFY_TYPE[kind]
  for (const { userId } of managers) {
    collectNotification(ctx, {
      userId,
      type,
      dedupKey: `${type}:org:${org.id}:audit:${auditId}:user:${userId}`,
      params: {
        kind: type,
        target: 'group_page',
        organizationId: org.id,
        organizationName: org.name,
        ...(reason
          ? {
              reasonTitle: groupPageModerationReasonTitle(reason.code),
              ...(reason.note ? { note: reason.note } : {}),
            }
          : {}),
      },
    })
  }
}

async function applyDecision(
  ctx: ServiceContext,
  orgId: number,
  data: z.output<typeof ActInput>,
): Promise<void> {
  const db = getDb(ctx)
  const org = await lockOrg(db, orgId)
  const before = await readModeration(db, orgId)
  if (before?.state === data.state) {
    throw new GroupPageModerationConflictError(
      'group_page.moderation_same_state',
      'Решение уже действует',
    )
  }
  if (data.state === 'noindex' && !before && !org.seoIndex) {
    throw new GroupPageModerationConflictError(
      'group_page.owner_noindex',
      'Владелец уже закрыл страницу от поиска',
    )
  }
  const values = {
    state: data.state,
    reasonCode: data.reasonCode,
    note: data.note,
    actorUserId: ctx.userId,
    updatedAt: new Date(),
  }
  await db
    .insert(groupPageModeration)
    .values({ organizationId: orgId, ...values })
    .onConflictDoUpdate({ target: groupPageModeration.organizationId, set: values })
  const entry = await auditService.record(ctx, {
    action:
      data.state === 'hidden'
        ? AUDIT_ACTIONS.GROUP_PAGE_HIDDEN
        : AUDIT_ACTIONS.GROUP_PAGE_NOINDEXED,
    entityType: 'organization',
    entityId: orgId,
    oldValue: before ? { state: before.state, reasonCode: before.reasonCode } : null,
    newValue: { state: data.state, reasonCode: data.reasonCode, note: data.note },
  })
  await notifyManagers(ctx, db, org, data.state, entry.id, {
    code: data.reasonCode,
    note: data.note,
  })
}

async function complaintStats(
  db: DbOrTx,
  now: Date,
): Promise<PlatformGroupPageComplaints['stats']> {
  const since = new Date(now.getTime() - 30 * DAY_MS)
  const [[open], [closed], [limited]] = await Promise.all([
    db
      .select({
        n: sql<number>`count(*)::int`,
        oldest: sql<Date | null>`min(${groupPageComplaints.createdAt})`,
      })
      .from(groupPageComplaints)
      .where(eq(groupPageComplaints.status, 'new')),
    db
      .select({
        n: sql<number>`count(*)::int`,
        hours: sql<
          number | null
        >`avg(extract(epoch FROM (${groupPageComplaints.resolvedAt} - ${groupPageComplaints.createdAt})) / 3600)::float8`,
      })
      .from(groupPageComplaints)
      .where(gte(groupPageComplaints.resolvedAt, since)),
    db
      .select({ n: sql<number>`coalesce(sum(${groupPageComplaintThrottle.limited}), 0)::int` })
      .from(groupPageComplaintThrottle)
      .where(gte(groupPageComplaintThrottle.day, since.toISOString().slice(0, 10))),
  ])
  const oldest = open?.oldest ? new Date(open.oldest) : null
  return {
    open: open?.n ?? 0,
    oldestOpenAt: oldest ? oldest.toISOString() : null,
    closed30d: closed?.n ?? 0,
    avgHoursToClose30d:
      closed?.hours === null || closed?.hours === undefined
        ? null
        : Math.round(Number(closed.hours) * 10) / 10,
    limited30d: limited?.n ?? 0,
  }
}

/**
 * Модерация страниц групп, Root Admin (24.1.3, R-06). Каждый метод проверяет root по базе.
 * Решение «скрыть» и «noindex» требует причину; «вернуть» — нет. Решения и их снятие пишутся в
 * `audit_log` (платформенная запись) и уходят владельцу и организаторам в ленту и бот.
 */
export const groupPageModerationService = {
  /** Справочник городов (районные центры и Минск) со счётчиками страниц; прочие города — `other`. */
  async cities(ctx: ServiceContext): Promise<PlatformGroupPageCities> {
    await assertRootAdmin(ctx)
    const pages = await pageRows(getDb(ctx))
    const byKey = new Map<string, PlatformGroupPageCity>()
    const regions = GROUP_PAGE_CITY_REGIONS.map(([region, cities]) => ({
      region,
      cities: cities.map((name) => {
        const c = emptyCity(name)
        byKey.set(moderationCityKey(name), c)
        return c
      }),
    }))
    const other = new Map<string, PlatformGroupPageCity>()
    for (const p of pages) {
      const name = p.city?.trim().replace(/\s+/g, ' ') || ''
      const key = moderationCityKey(name)
      let c = byKey.get(key)
      if (!c) {
        c = other.get(key) ?? emptyCity(name)
        other.set(key, c)
      }
      addPage(c, p)
    }
    const all = [...byKey.values(), ...other.values()]
    return {
      regions,
      other: [...other.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      totals: {
        cities: byKey.size,
        citiesWithPages: all.filter((c) => c.pages > 0).length,
        pages: pages.length,
        indexed: pages.filter((p) => p.state === 'index').length,
        noindex: pages.filter((p) => p.state === 'noindex').length,
        hidden: pages.filter((p) => p.state === 'hidden').length,
      },
    }
  },

  /** Страницы города (или всей страны), фильтр «скрытые и noindex» / «с жалобами», поиск. */
  async list(ctx: ServiceContext, query: unknown): Promise<PlatformGroupPagesList> {
    await assertRootAdmin(ctx)
    const q = ListGroupPagesQuery.parse(query ?? {})
    let items = await pageRows(getDb(ctx))
    if (q.city) {
      const key = moderationCityKey(q.city)
      items = items.filter((p) => moderationCityKey(p.city ?? '') === key)
    }
    if (q.filter === 'moderated')
      items = items.filter((p) => p.state === 'hidden' || p.state === 'noindex')
    if (q.filter === 'complaints') items = items.filter((p) => p.newComplaints > 0)
    if (q.q) {
      const needle = moderationCityKey(q.q)
      items = items.filter(
        (p) => moderationCityKey(p.name).includes(needle) || p.slug.includes(needle),
      )
    }
    return { items }
  },

  /** «Скрыть» или «Принудительный noindex» с обязательной причиной и заметкой «Что исправить». */
  async act(ctx: ServiceContext, orgId: number, input: unknown): Promise<PlatformGroupPageRow> {
    await assertRootAdmin(ctx)
    const data = ActInput.parse(input ?? {})
    return inTransaction(ctx, async (tx) => {
      await applyDecision(tx, orgId, data)
      return (await pageRows(getDb(tx), eq(organizations.id, orgId)))[0]!
    })
  },

  /** «Вернуть» / «Вернуть индексацию»: решение снимается, дальше решает настройка владельца. */
  async restore(ctx: ServiceContext, orgId: number): Promise<PlatformGroupPageRow> {
    await assertRootAdmin(ctx)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const org = await lockOrg(db, orgId)
      const before = await readModeration(db, orgId)
      if (!before) {
        throw new GroupPageModerationConflictError(
          'group_page.not_moderated',
          'На странице нет решения администрации',
        )
      }
      await db.delete(groupPageModeration).where(eq(groupPageModeration.organizationId, orgId))
      const entry = await auditService.record(tx, {
        action: AUDIT_ACTIONS.GROUP_PAGE_RESTORED,
        entityType: 'organization',
        entityId: orgId,
        oldValue: { state: before.state, reasonCode: before.reasonCode },
        newValue: null,
      })
      await notifyManagers(tx, db, org, 'restored', entry.id, null)
      return (await pageRows(db, eq(organizations.id, orgId)))[0]!
    })
  },

  /** Состояние и журнал страницы: решения root (с автором) и жалобы (без автора). */
  async history(ctx: ServiceContext, orgId: number): Promise<PlatformGroupPageHistory> {
    await assertRootAdmin(ctx)
    const db = getDb(ctx)
    const [page] = await pageRows(
      db,
      and(eq(organizations.id, orgId), isNull(organizations.deletedAt)),
    )
    if (!page) throw new OrganizationNotFoundError(orgId)
    const [decisions, complaints] = await Promise.all([
      db
        .select({
          at: auditLog.createdAt,
          action: auditLog.action,
          newValue: auditLog.newValue,
          actorId: users.id,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.userId))
        .where(
          and(
            eq(auditLog.entityType, 'organization'),
            eq(auditLog.entityId, orgId),
            inArray(auditLog.action, [
              AUDIT_ACTIONS.GROUP_PAGE_HIDDEN,
              AUDIT_ACTIONS.GROUP_PAGE_NOINDEXED,
              AUDIT_ACTIONS.GROUP_PAGE_RESTORED,
            ]),
          ),
        )
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(100),
      db
        .select({ at: groupPageComplaints.createdAt, reason: groupPageComplaints.reasonCode })
        .from(groupPageComplaints)
        .where(eq(groupPageComplaints.organizationId, orgId))
        .orderBy(desc(groupPageComplaints.createdAt))
        .limit(100),
    ])
    const entries: PlatformGroupPageHistoryEntry[] = [
      ...decisions.map((d): PlatformGroupPageHistoryEntry => {
        const v = (d.newValue ?? {}) as { reasonCode?: string; note?: string | null }
        const kind =
          d.action === AUDIT_ACTIONS.GROUP_PAGE_HIDDEN
            ? 'hidden'
            : d.action === AUDIT_ACTIONS.GROUP_PAGE_NOINDEXED
              ? 'noindex'
              : 'restored'
        return {
          at: d.at.toISOString(),
          kind,
          reasonCode: v.reasonCode ?? null,
          reasonTitle: v.reasonCode ? groupPageModerationReasonTitle(v.reasonCode) : null,
          note: v.note ?? null,
          actor:
            d.actorId === null ? null : { id: d.actorId, name: d.actorName || d.actorEmail || '' },
        }
      }),
      ...complaints.map((c): PlatformGroupPageHistoryEntry => ({
        at: c.at.toISOString(),
        kind: 'complaint',
        reasonCode: c.reason,
        reasonTitle: groupPageComplaintReasonTitle(c.reason),
        note: null,
        actor: null,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at))
    return { page, entries }
  },

  /** Жалобы: новые, закрытые (решённые и отклонённые) или все; автор — только для root. */
  async complaints(
    ctx: ServiceContext,
    query: unknown,
    now = new Date(),
  ): Promise<PlatformGroupPageComplaints> {
    await assertRootAdmin(ctx)
    const q = ComplaintsQuery.parse(query ?? {})
    const db = getDb(ctx)
    const statusWhere =
      q.status === 'new'
        ? eq(groupPageComplaints.status, 'new')
        : q.status === 'closed'
          ? inArray(groupPageComplaints.status, ['rejected', 'resolved'])
          : undefined
    const rows = await db
      .select({
        c: groupPageComplaints,
        groupName: organizations.name,
        slug: organizations.slug,
        city: organizations.city,
        seoIndex: organizations.seoIndex,
        modState: groupPageModeration.state,
        reporterName: users.name,
        reporterUsername: users.telegramUsername,
        sameReasonOpen: sql<number>`(SELECT count(*)::int FROM ${groupPageComplaints} o
          WHERE o.organization_id = ${groupPageComplaints.organizationId}
            AND o.reason_code = ${groupPageComplaints.reasonCode}
            AND o.status = 'new' AND o.id <> ${groupPageComplaints.id})`,
      })
      .from(groupPageComplaints)
      .innerJoin(organizations, eq(organizations.id, groupPageComplaints.organizationId))
      .leftJoin(groupPageModeration, eq(groupPageModeration.organizationId, organizations.id))
      .leftJoin(users, eq(users.id, groupPageComplaints.reporterUserId))
      .where(statusWhere)
      .orderBy(desc(groupPageComplaints.createdAt), desc(groupPageComplaints.id))
      .limit(200)
    return {
      items: rows.map((r) => ({
        id: r.c.id,
        organizationId: r.c.organizationId,
        groupName: r.groupName,
        slug: r.slug,
        city: r.city,
        pageState: pageState(r.seoIndex, r.modState),
        reasonCode: r.c.reasonCode as GroupPageComplaintReason,
        reasonTitle: groupPageComplaintReasonTitle(r.c.reasonCode),
        details: r.c.details,
        reporter:
          r.c.reporterUserId === null
            ? { kind: 'anonymous' as const }
            : {
                kind: 'user' as const,
                id: r.c.reporterUserId,
                name: r.reporterName ?? '',
                telegramUsername: r.reporterUsername,
              },
        status: r.c.status as GroupPageComplaintStatus,
        resolution: r.c.resolution as GroupPageComplaintResolution | null,
        resolvedAt: r.c.resolvedAt?.toISOString() ?? null,
        createdAt: r.c.createdAt.toISOString(),
        sameReasonOpen: r.sameReasonOpen,
      })),
      stats: await complaintStats(db, now),
    }
  },

  /** «Отклонить» — нарушений нет. */
  async rejectComplaint(ctx: ServiceContext, id: number): Promise<{ id: number }> {
    await assertRootAdmin(ctx)
    return inTransaction(ctx, async (tx) => {
      const c = await lockComplaint(getDb(tx), id)
      await closeComplaint(tx, c.id, 'rejected', 'no_violation')
      await auditService.record(tx, {
        action: AUDIT_ACTIONS.GROUP_PAGE_COMPLAINT_REJECTED,
        entityType: 'group_page_complaint',
        entityId: c.id,
        newValue: { organizationId: c.organizationId },
      })
      return { id: c.id }
    })
  },

  /**
   * Решение по странице из жалобы: «Скрыть» или «Noindex» с причиной; жалоба закрывается этим
   * решением. Если решение уже действует (страницу скрыли по другой жалобе), жалоба закрывается
   * им без нового решения и без повторного уведомления.
   */
  async resolveComplaint(
    ctx: ServiceContext,
    id: number,
    input: unknown,
  ): Promise<{ id: number; page: PlatformGroupPageRow }> {
    await assertRootAdmin(ctx)
    const data = ActInput.parse(input ?? {})
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const c = await lockComplaint(db, id)
      // блокировка группы до чтения решения: параллельное «Скрыть» по другой жалобе на ту же
      // страницу не даёт ложного moderation_same_state, а закрывает жалобу действующим решением
      await lockOrg(db, c.organizationId)
      const current = await readModeration(db, c.organizationId)
      if (current?.state !== data.state) await applyDecision(tx, c.organizationId, data)
      await closeComplaint(tx, c.id, 'resolved', data.state)
      return { id: c.id, page: (await pageRows(db, eq(organizations.id, c.organizationId)))[0]! }
    })
  },
}

async function lockComplaint(db: DbOrTx, id: number) {
  if (!Number.isInteger(id) || id <= 0 || id > INT4_MAX)
    throw new GroupPageComplaintNotFoundError(id)
  const [c] = await db
    .select()
    .from(groupPageComplaints)
    .where(eq(groupPageComplaints.id, id))
    .for('update')
  if (!c) throw new GroupPageComplaintNotFoundError(id)
  if (c.status !== 'new') throw new GroupPageComplaintClosedError()
  return c
}

async function closeComplaint(
  ctx: ServiceContext,
  id: number,
  status: 'rejected' | 'resolved',
  resolution: GroupPageComplaintResolution,
): Promise<void> {
  await getDb(ctx)
    .update(groupPageComplaints)
    .set({ status, resolution, resolvedByUserId: ctx.userId, resolvedAt: new Date() })
    .where(eq(groupPageComplaints.id, id))
}

/** Пространство advisory-lock лимита жалоб: один клиент — одна очередь проверки лимита. */
const COMPLAINT_LOCK_NS = 2146

/**
 * Жалоба посетителя на публичную страницу (24.1.3), без входа. Неизвестный slug, неопубликованная
 * и скрытая root страница — тот же 404. Не больше 3 жалоб за скользящие сутки с устройства
 * (`reporterHash` — HMAC адреса клиента, считает web); отсечённая попытка увеличивает счётчик
 * суток и не сохраняется. Ответ не раскрывает ни состояние страницы, ни других жалоб.
 */
export async function submitGroupPageComplaint(
  slug: string,
  input: unknown,
  reporter: { userId: number | null; hash: string },
  now = new Date(),
  ctx: ServiceContext = systemContext(),
): Promise<{ id: number }> {
  if (!GROUP_SLUG_RE.test(slug)) throw new GroupPageNotFoundError()
  const data = ComplaintInput.parse(input ?? {})
  if (!/^[0-9a-f]{64}$/.test(reporter.hash)) throw new Error('reporter hash must be sha256 hex')
  const limited = await inTransaction(ctx, async (tx) => {
    const db = getDb(tx)
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(
          eq(organizations.slug, slug),
          eq(organizations.status, 'active'),
          isNull(organizations.deletedAt),
          eq(organizations.publicPageEnabled, true),
          sql`NOT EXISTS (SELECT 1 FROM ${groupPageModeration} m
            WHERE m.organization_id = ${organizations.id} AND m.state = 'hidden')`,
        ),
      )
    if (!org) throw new GroupPageNotFoundError()
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(${COMPLAINT_LOCK_NS}, hashtext(${reporter.hash}))`,
    )
    const [recent] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(groupPageComplaints)
      .where(
        and(
          eq(groupPageComplaints.reporterHash, reporter.hash),
          gte(groupPageComplaints.createdAt, new Date(now.getTime() - DAY_MS)),
        ),
      )
    if ((recent?.n ?? 0) >= GROUP_PAGE_COMPLAINTS_PER_DAY) {
      await db
        .insert(groupPageComplaintThrottle)
        .values({ day: now.toISOString().slice(0, 10), limited: 1 })
        .onConflictDoUpdate({
          target: groupPageComplaintThrottle.day,
          set: { limited: sql`${groupPageComplaintThrottle.limited} + 1` },
        })
      return null
    }
    const [row] = await db
      .insert(groupPageComplaints)
      .values({
        organizationId: org.id,
        reasonCode: data.reasonCode,
        details: data.details,
        reporterUserId: reporter.userId,
        reporterHash: reporter.hash,
        createdAt: now,
      })
      .returning({ id: groupPageComplaints.id })
    return row!
  })
  if (!limited) throw new GroupPageComplaintLimitError()
  return limited
}
