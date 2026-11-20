import {
  OperatorError,
  alias,
  and,
  approvePurchaseRequest,
  asc,
  desc,
  eq,
  eventBalanceEntries,
  eventBalancePurchaseRequests,
  gte,
  lt,
  organizations,
  rejectPurchaseRequest,
  sql,
  users,
  type DbOrTx,
} from '@volley-time/db'
import {
  DEFAULT_TIMEZONE,
  PLATFORM_PURCHASE_REASON_MAX,
  PLATFORM_PURCHASE_REASON_MIN,
  PLATFORM_PURCHASE_STATUSES,
  formatShortDate,
  formatTime,
  type PlatformPurchaseDecisionResult,
  type PlatformPurchaseRequestRow,
  type PlatformPurchaseRequestsPage,
  type PlatformPurchaseSummary,
} from '@volley-time/shared'
import { z } from 'zod'

import { csvCell, formatCsvAmount } from '../ledger/csv'
import { EXPORT_MAX_ROWS } from '../ledger/service'
import { assertRootAdmin } from '../permissions/root'
import { type ServiceContext, getDb, inTransaction } from '../shared/context'

import { PlatformPurchaseRequestError } from './errors'

const INT4_MAX = 2_147_483_647
/** Источник решения в audit_log: отличает Root Admin от операторской команды (`operator-cli`). */
const SOURCE = 'root-admin'

/** Сколько строк «Доходов по организациям» отдаёт сводка; сверх этого — `byOrganizationTruncated`. */
const BY_ORG_LIMIT = 100

const Id = z.coerce.number().int().positive().max(INT4_MAX)
const Instant = z.iso.datetime({ offset: true }).transform((s) => new Date(s))
/** Период `[from, to)`; границы считает клиент (часовой пояс зрителя). */
const Period = z.object({ from: Instant.optional(), to: Instant.optional() })

const ListQuery = Period.extend({
  status: z.enum(PLATFORM_PURCHASE_STATUSES).optional(),
  organizationId: Id.optional(),
  cursor: Id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const ApproveInput = z
  .object({
    requestId: Id,
    comment: z.string().trim().max(PLATFORM_PURCHASE_REASON_MAX).optional(),
  })
  .strict()
const RejectInput = z
  .object({
    requestId: Id,
    reason: z.string().trim().min(PLATFORM_PURCHASE_REASON_MIN).max(PLATFORM_PURCHASE_REASON_MAX),
  })
  .strict()

type Query = Record<string, unknown>

const decider = alias(users, 'decider')
const requester = alias(users, 'requester')
const req = eventBalancePurchaseRequests

function selectRows(db: DbOrTx) {
  return db
    .select({
      id: req.id,
      orgId: organizations.id,
      orgName: organizations.name,
      units: req.units,
      amount: req.amount,
      currency: req.currency,
      status: req.status,
      createdAt: req.createdAt,
      decidedAt: req.decidedAt,
      decisionComment: req.decisionComment,
      deciderId: decider.id,
      deciderName: decider.name,
      requesterId: requester.id,
      requesterName: requester.name,
    })
    .from(req)
    .innerJoin(organizations, eq(organizations.id, req.organizationId))
    .leftJoin(decider, eq(decider.id, req.decidedByUserId))
    .leftJoin(requester, eq(requester.id, req.requestedByUserId))
}

type RawRow = Awaited<ReturnType<ReturnType<typeof selectRows>['execute']>>[number]

function toRow(r: RawRow): PlatformPurchaseRequestRow {
  return {
    id: r.id,
    organization: { id: r.orgId, name: r.orgName },
    units: r.units,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decidedBy: r.deciderId === null ? null : { id: r.deciderId, name: r.deciderName ?? '' },
    decisionComment: r.decisionComment,
    requestedBy: r.requesterId === null ? null : { id: r.requesterId, name: r.requesterName ?? '' },
  }
}

async function loadRow(db: DbOrTx, id: number): Promise<PlatformPurchaseRequestRow> {
  const [row] = await selectRows(db).where(eq(req.id, id))
  return toRow(row!)
}

function periodOf(
  column: typeof req.decidedAt | typeof req.createdAt,
  p: { from?: Date; to?: Date },
) {
  return and(p.from ? gte(column, p.from) : undefined, p.to ? lt(column, p.to) : undefined)
}

/** Ошибку операторской логики — в доменную ошибку Root Admin (404/409). */
function mapOperatorError(e: unknown): never {
  if (e instanceof OperatorError) {
    if (e.code === 'purchase_request.not_found' || e.code === 'purchase_request.not_pending') {
      throw new PlatformPurchaseRequestError(
        e.code,
        e.code === 'purchase_request.not_found' ? 'Заявка не найдена' : 'Заявка уже обработана',
      )
    }
  }
  throw e
}

/** Проверить заявку до решения: есть, ждёт, организация не удалена (для подтверждения). */
async function precheck(db: DbOrTx, requestId: number, approving: boolean): Promise<void> {
  const [row] = await db
    .select({ status: req.status, deletedAt: organizations.deletedAt })
    .from(req)
    .innerJoin(organizations, eq(organizations.id, req.organizationId))
    .where(eq(req.id, requestId))
  if (!row)
    throw new PlatformPurchaseRequestError('purchase_request.not_found', 'Заявка не найдена')
  if (row.status !== 'pending') {
    throw new PlatformPurchaseRequestError('purchase_request.not_pending', 'Заявка уже обработана')
  }
  // D-15: на время окна восстановления деньги группы не меняются
  if (approving && row.deletedAt) {
    throw new PlatformPurchaseRequestError('platform.purchase_org_deleted', 'Организация удалена')
  }
}

/**
 * Заявки организаций на покупку баланса событий (22.2.3, R-04 в объёме D-07). Решения идут через
 * ту же логику, что и операторская команда (packages/db `approvePurchaseRequest` /
 * `rejectPurchaseRequest`): блокировка заявки FOR UPDATE, условный переход `pending → …`, запись
 * журнала на снимок заявки и audit_log — одна транзакция. Выплат, возвратов и сверки с платёжным
 * провайдером нет до фазы 12.
 */
export const platformPurchaseRequestsService = {
  /** Реестр: фильтры статуса, организации и периода (по дате заявки); keyset по `id`, новые сверху. */
  async list(ctx: ServiceContext, query: Query = {}): Promise<PlatformPurchaseRequestsPage> {
    await assertRootAdmin(ctx)
    const q = ListQuery.parse(query)
    const rows = await selectRows(getDb(ctx))
      .where(
        and(
          q.status ? eq(req.status, q.status) : undefined,
          q.organizationId ? eq(req.organizationId, q.organizationId) : undefined,
          periodOf(req.createdAt, q),
          q.cursor === undefined ? undefined : lt(req.id, q.cursor),
        ),
      )
      .orderBy(desc(req.id))
      .limit(q.limit + 1)
    const page = rows.slice(0, q.limit)
    return {
      items: page.map(toRow),
      nextCursor: rows.length > q.limit ? page[page.length - 1]!.id : null,
    }
  },

  /**
   * Итоги периода (по дате решения): сумма подтверждённых по валютам, ожидающие, отклонённые,
   * платящие организации, доходы по организациям и сверка с журналом баланса (`purchase`).
   */
  async summary(ctx: ServiceContext, query: Query = {}): Promise<PlatformPurchaseSummary> {
    await assertRootAdmin(ctx)
    const p = Period.parse(query)
    const db = getDb(ctx)
    const approvedIn = and(eq(req.status, 'approved'), periodOf(req.decidedAt, p))
    const totals = await db
      .select({
        currency: req.currency,
        amount: sql<number>`coalesce(sum(${req.amount}), 0)::bigint`.mapWith(Number),
        count: sql<number>`count(*)::int`,
        units: sql<number>`coalesce(sum(${req.units}), 0)::bigint`.mapWith(Number),
      })
      .from(req)
      .where(approvedIn)
      .groupBy(req.currency)
      .orderBy(asc(req.currency))
    const [counts] = await db
      .select({
        pending: sql<number>`count(*) FILTER (WHERE ${req.status} = 'pending')::int`,
        rejected: sql<number>`count(*) FILTER (WHERE ${req.status} = 'rejected' AND ${periodOf(req.decidedAt, p) ?? sql`true`})::int`,
        paying: sql<number>`count(DISTINCT ${req.organizationId}) FILTER (WHERE ${approvedIn})::int`,
      })
      .from(req)
    const [ledger] = await db
      .select({
        units: sql<number>`coalesce(sum(${eventBalanceEntries.delta}), 0)::bigint`.mapWith(Number),
        entries: sql<number>`count(*)::int`,
      })
      .from(eventBalanceEntries)
      .where(
        and(
          eq(eventBalanceEntries.reason, 'purchase'),
          p.from ? gte(eventBalanceEntries.createdAt, p.from) : undefined,
          p.to ? lt(eventBalanceEntries.createdAt, p.to) : undefined,
        ),
      )
    const byOrg = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        currency: req.currency,
        amount: sql<number>`sum(${req.amount})::bigint`.mapWith(Number),
        units: sql<number>`sum(${req.units})::bigint`.mapWith(Number),
        count: sql<number>`count(*)::int`,
      })
      .from(req)
      .innerJoin(organizations, eq(organizations.id, req.organizationId))
      .where(approvedIn)
      .groupBy(organizations.id, organizations.name, req.currency)
      .orderBy(sql`sum(${req.amount}) DESC`, asc(organizations.id))
      .limit(BY_ORG_LIMIT + 1)
    const approvedUnits = totals.reduce((n, t) => n + t.units, 0)
    const approvedCount = totals.reduce((n, t) => n + t.count, 0)
    return {
      from: p.from?.toISOString() ?? null,
      to: p.to?.toISOString() ?? null,
      approved: totals,
      // pendingCount не зависит от периода: ожидающие за всё время (UI подписывает «всего»)
      pendingCount: counts!.pending,
      rejectedCount: counts!.rejected,
      payingOrganizations: counts!.paying,
      ledger: {
        approvedUnits,
        ledgerUnits: ledger!.units,
        ledgerEntries: ledger!.entries,
        matches: approvedUnits === ledger!.units && approvedCount === ledger!.entries,
      },
      byOrganizationTruncated: byOrg.length > BY_ORG_LIMIT,
      byOrganization: byOrg.slice(0, BY_ORG_LIMIT).map((r) => ({
        organization: { id: r.orgId, name: r.orgName },
        currency: r.currency,
        amount: r.amount,
        units: r.units,
        count: r.count,
      })),
    }
  },

  /** Подтверждённые заявки периода (по дате решения) для выгрузки; не больше EXPORT_MAX_ROWS + 1. */
  async exportRows(ctx: ServiceContext, query: Query = {}): Promise<PlatformPurchaseRequestRow[]> {
    await assertRootAdmin(ctx)
    const p = Period.parse(query)
    const rows = await selectRows(getDb(ctx))
      .where(and(eq(req.status, 'approved'), periodOf(req.decidedAt, p)))
      .orderBy(asc(req.decidedAt), asc(req.id))
      .limit(EXPORT_MAX_ROWS + 1)
    return rows.map(toRow)
  },

  /** Подтвердить: начисление на снимок заявки (не текущую цену пакета), автор root, аудит. */
  async approve(
    ctx: ServiceContext,
    input: { requestId: number | string; comment?: string },
  ): Promise<PlatformPurchaseDecisionResult> {
    await assertRootAdmin(ctx)
    const data = ApproveInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      await precheck(db, data.requestId, true)
      const { entry } = await approvePurchaseRequest(db, {
        requestId: data.requestId,
        operatorId: ctx.userId,
        comment: data.comment,
        source: SOURCE,
      }).catch(mapOperatorError)
      return { request: await loadRow(db, data.requestId), balanceAfter: entry.balanceAfter }
    })
  },

  /** Отклонить с обязательной причиной; баланс не меняется. */
  async reject(
    ctx: ServiceContext,
    input: { requestId: number | string; reason: string },
  ): Promise<PlatformPurchaseDecisionResult> {
    await assertRootAdmin(ctx)
    const data = RejectInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      await precheck(db, data.requestId, false)
      await rejectPurchaseRequest(db, {
        requestId: data.requestId,
        operatorId: ctx.userId,
        comment: data.reason,
        source: SOURCE,
      }).catch(mapOperatorError)
      return { request: await loadRow(db, data.requestId), balanceAfter: null }
    })
  },
}

export const PURCHASE_REQUESTS_CSV_HEADER = [
  'Заявка',
  'Создана',
  'Подтверждена',
  'Организация ID',
  'Организация',
  'Событий',
  'Сумма',
  'Сумма (коп.)',
  'Валюта',
  'Подтвердил',
  'Комментарий',
] as const

const stamp = (iso: string | null) =>
  iso ? `${formatShortDate(iso, DEFAULT_TIMEZONE)} ${formatTime(iso, DEFAULT_TIMEZONE)}` : null

/**
 * CSV платежей организаций: UTF-8 с BOM, `;`, CRLF, время — Europe/Minsk. Сумма дважды: «10,50» для
 * таблицы и минорные единицы для точной сверки. Без контактов организатора (email/телефон);
 * значения, похожие на формулу, нейтрализует `csvCell`.
 */
export function buildPurchaseRequestsCsv(rows: readonly PlatformPurchaseRequestRow[]): string {
  const lines = [PURCHASE_REQUESTS_CSV_HEADER.join(';')]
  for (const r of rows) {
    lines.push(
      [
        String(r.id),
        stamp(r.createdAt),
        stamp(r.decidedAt),
        String(r.organization.id),
        r.organization.name,
        String(r.units),
        formatCsvAmount(r.amount),
        String(r.amount),
        r.currency,
        r.decidedBy?.name ?? null,
        r.decisionComment,
      ]
        .map((cell) => csvCell(cell))
        .join(';'),
    )
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
