/**
 * Операторская команда баланса событий для root (20.2.1, мост до UI 22.2.2/22.2.3).
 *
 * Каждое изменение баланса — строка журнала с автором-оператором (users.is_root_admin, проверяется в
 * базе) и причиной (комментарий), плюс запись audit_log. Изменения идут через appendEventBalanceEntry
 * (блокировка проекции, баланс никогда не уходит в минус). Команда живёт в packages/db, потому что
 * production-образ миграций — единственный с tsx и доступом к БД:
 *
 *   docker compose -f docker-compose.prod.yml run --rm --no-deps migrate \
 *     node ./node_modules/tsx/dist/cli.mjs src/event-balance-operator.ts <command> [options]
 *
 * Локально: `pnpm db:event-balance <command> [options]`.
 *
 * Команды:
 *   grant     --org <id> --units <n> --operator <root email> --comment "<причина>"
 *   correct   --org <id> --units <±n> --operator <root email> --comment "<причина>"
 *   approve   --request <id> --operator <root email> [--comment "<комментарий>"]
 *   reject    --request <id> --operator <root email> --comment "<причина>"
 *   reconcile --operator <root email> [--apply] [--since <ISO-дата>]
 *
 * `reconcile` без `--apply` только показывает: расхождение проекции с суммой журнала, организации без
 * стартового начисления (нет ни demo_grant, ни pilot_grant — созданы runtime без баланса), события,
 * опубликованные без списания. С `--apply` выдаёт таким организациям demo-квоту (правило
 * совместимости 5 ADR v3); расхождения и события без списания исправляются только явной командой
 * `correct` по решению оператора.
 */
import { pathToFileURL } from 'node:url'

import { and, asc, eq, sql } from 'drizzle-orm'

import type { DB, DbOrTx } from './client'
import {
  appendEventBalanceEntry,
  EVENT_BALANCE_DEMO_QUOTA,
  type EventBalanceEntryInput,
} from './event-balance'
import {
  auditLog,
  eventBalanceEntries,
  eventBalancePurchaseRequests,
  organizations,
  users,
  type EventBalanceEntry,
  type EventBalancePurchaseRequest,
} from './schema'

export class OperatorError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'OperatorError'
  }
}

const OPERATOR_SOURCE = 'operator-cli'

async function resolveOperator(db: DbOrTx, email: string): Promise<number> {
  const [user] = await db
    .select({ id: users.id, isRootAdmin: users.isRootAdmin, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, email))
  if (!user || !user.isRootAdmin || !user.isActive) {
    throw new OperatorError('forbidden.root_only', `Operator ${email} is not an active root admin`)
  }
  return user.id
}

function requireComment(comment: string | undefined): string {
  const value = comment?.trim()
  if (!value)
    throw new OperatorError('operator.comment_required', 'A non-empty --comment is required')
  return value
}

async function requireOrganization(db: DbOrTx, organizationId: number): Promise<void> {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!org) throw new OperatorError('organization.not_found', `No organization ${organizationId}`)
}

async function audit(
  db: DbOrTx,
  params: {
    operatorId: number
    organizationId: number
    action: string
    entityType: string
    entityId: number
    oldValue?: unknown
    newValue: unknown
  },
) {
  await db.insert(auditLog).values({
    organizationId: params.organizationId,
    userId: params.operatorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue,
  })
}

async function append(db: DbOrTx, input: EventBalanceEntryInput): Promise<EventBalanceEntry> {
  try {
    return await appendEventBalanceEntry(db, input)
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'event_balance.insufficient') {
      throw new OperatorError('event_balance.insufficient', e.message)
    }
    throw e
  }
}

/** Начисление (`grant`, units > 0) или исправление (`correction`, units ≠ 0) с автором и причиной. */
export async function grantEventBalance(
  database: DB,
  params: {
    organizationId: number
    units: number
    operator: string
    comment?: string
    correction?: boolean
  },
): Promise<EventBalanceEntry> {
  const comment = requireComment(params.comment)
  const valid = params.correction
    ? Number.isSafeInteger(params.units) && params.units !== 0
    : Number.isSafeInteger(params.units) && params.units > 0
  if (!valid) {
    throw new OperatorError(
      'operator.invalid_units',
      params.correction
        ? '--units must be a non-zero integer'
        : '--units must be a positive integer',
    )
  }
  return database.transaction(async (tx) => {
    const operatorId = await resolveOperator(tx, params.operator)
    await requireOrganization(tx, params.organizationId)
    const entry = await append(tx, {
      organizationId: params.organizationId,
      delta: params.units,
      reason: params.correction ? 'correction' : 'grant',
      actor: { kind: 'user', userId: operatorId },
      comment,
    })
    await audit(tx, {
      operatorId,
      organizationId: params.organizationId,
      action: params.correction ? 'event_balance.corrected' : 'event_balance.granted',
      entityType: 'event_balance_entry',
      entityId: entry.id,
      newValue: {
        delta: entry.delta,
        balanceAfter: entry.balanceAfter,
        comment,
        source: OPERATOR_SOURCE,
      },
    })
    return entry
  })
}

/** Заблокировать заявку и убедиться, что она ещё ждёт решения. */
async function lockPendingRequest(
  db: DbOrTx,
  requestId: number,
): Promise<EventBalancePurchaseRequest> {
  const [request] = await db
    .select()
    .from(eventBalancePurchaseRequests)
    .where(eq(eventBalancePurchaseRequests.id, requestId))
    .for('update')
  if (!request) {
    throw new OperatorError('purchase_request.not_found', `No purchase request ${requestId}`)
  }
  if (request.status !== 'pending') {
    throw new OperatorError(
      'purchase_request.not_pending',
      `Purchase request ${requestId} is ${request.status}`,
    )
  }
  return request
}

/** Решение по заявке условным UPDATE `pending → status` (повтор — 0 строк → not_pending). */
async function decide(
  db: DbOrTx,
  requestId: number,
  status: 'approved' | 'rejected',
  operatorId: number,
  comment: string | null,
): Promise<EventBalancePurchaseRequest> {
  const [decided] = await db
    .update(eventBalancePurchaseRequests)
    .set({ status, decidedByUserId: operatorId, decidedAt: new Date(), decisionComment: comment })
    .where(
      and(
        eq(eventBalancePurchaseRequests.id, requestId),
        eq(eventBalancePurchaseRequests.status, 'pending'),
      ),
    )
    .returning()
  if (!decided) {
    throw new OperatorError(
      'purchase_request.not_pending',
      `Purchase request ${requestId} is decided`,
    )
  }
  return decided
}

/** Подтвердить заявку: `pending → approved` и запись `purchase` на снимок количества — одна транзакция. */
export async function approvePurchaseRequest(
  database: DB,
  params: { requestId: number; operator: string; comment?: string },
): Promise<{ request: EventBalancePurchaseRequest; entry: EventBalanceEntry }> {
  const comment = params.comment?.trim() || null
  return database.transaction(async (tx) => {
    const operatorId = await resolveOperator(tx, params.operator)
    await lockPendingRequest(tx, params.requestId)
    const request = await decide(tx, params.requestId, 'approved', operatorId, comment)
    const entry = await append(tx, {
      organizationId: request.organizationId,
      delta: request.units,
      reason: 'purchase',
      purchaseRequestId: request.id,
      actor: { kind: 'user', userId: operatorId },
      comment,
    })
    await audit(tx, {
      operatorId,
      organizationId: request.organizationId,
      action: 'event_balance.purchase_approved',
      entityType: 'event_balance_purchase_request',
      entityId: request.id,
      oldValue: { status: 'pending' },
      newValue: {
        status: 'approved',
        units: request.units,
        amount: request.amount,
        currency: request.currency,
        balanceAfter: entry.balanceAfter,
        comment,
        source: OPERATOR_SOURCE,
      },
    })
    return { request, entry }
  })
}

/** Отклонить заявку (с причиной); баланс не меняется. */
export async function rejectPurchaseRequest(
  database: DB,
  params: { requestId: number; operator: string; comment?: string },
): Promise<EventBalancePurchaseRequest> {
  const comment = requireComment(params.comment)
  return database.transaction(async (tx) => {
    const operatorId = await resolveOperator(tx, params.operator)
    await lockPendingRequest(tx, params.requestId)
    const request = await decide(tx, params.requestId, 'rejected', operatorId, comment)
    await audit(tx, {
      operatorId,
      organizationId: request.organizationId,
      action: 'event_balance.purchase_rejected',
      entityType: 'event_balance_purchase_request',
      entityId: request.id,
      oldValue: { status: 'pending' },
      newValue: { status: 'rejected', comment, source: OPERATOR_SOURCE },
    })
    return request
  })
}

export interface ReconcileReport {
  /** Проекция не равна сумме журнала (ожидается пусто). */
  drift: { organizationId: number; balance: number; journal: number }[]
  /** Организации без demo_grant и без pilot_grant. */
  withoutStartingGrant: number[]
  /** Неотменённые опубликованные события без списания, созданные после `since`. */
  unspentEvents: { eventId: number; organizationId: number; createdAt: Date }[]
  /** Кому выдана demo-квота в этом запуске (`--apply`). */
  demoGranted: number[]
}

/**
 * Сверка журнала и проекции. `since` по умолчанию — момент первого pilot_grant (выкладка миграции
 * 0024): события раньше этого момента созданы до баланса и списания не требуют (D-12).
 */
export async function reconcileEventBalance(
  database: DB,
  params: { operator: string; apply: boolean; since?: Date },
): Promise<ReconcileReport> {
  return database.transaction(async (tx) => {
    const operatorId = await resolveOperator(tx, params.operator)

    const drift = (
      await tx.execute<{ organization_id: number; balance: number; journal: number }>(sql`
        SELECT o.id AS organization_id, coalesce(b.balance, 0)::int AS balance,
               coalesce(e.s, 0)::int AS journal
        FROM organizations o
        LEFT JOIN organization_event_balances b ON b.organization_id = o.id
        LEFT JOIN (SELECT organization_id, sum(delta) AS s FROM event_balance_entries GROUP BY 1) e
          ON e.organization_id = o.id
        WHERE coalesce(b.balance, 0) <> coalesce(e.s, 0)
        ORDER BY o.id`)
    ).map((r) => ({ organizationId: r.organization_id, balance: r.balance, journal: r.journal }))

    const withoutStartingGrant = (
      await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(
          sql`NOT EXISTS (SELECT 1 FROM ${eventBalanceEntries} e WHERE e.organization_id = ${organizations.id}
                AND e.reason IN ('demo_grant', 'pilot_grant'))`,
        )
        .orderBy(asc(organizations.id))
    ).map((r) => r.id)

    let since = params.since
    if (!since) {
      const [first] = await tx
        .select({ at: sql<Date | null>`min(${eventBalanceEntries.createdAt})` })
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.reason, 'pilot_grant'))
      since = first?.at ? new Date(first.at) : new Date(0)
    }
    const unspentEvents = (
      await tx.execute<{ id: number; organization_id: number; created_at: string }>(sql`
        SELECT ev.id, ev.organization_id, ev.created_at FROM events ev
        WHERE ev.status IN ('published', 'closed', 'finished') AND ev.created_at >= ${since.toISOString()}
          AND NOT EXISTS (SELECT 1 FROM event_balance_entries s WHERE s.event_id = ev.id AND s.reason = 'spend')
        ORDER BY ev.id`)
    ).map((r) => ({
      eventId: r.id,
      organizationId: r.organization_id,
      createdAt: new Date(r.created_at),
    }))

    const demoGranted: number[] = []
    if (params.apply) {
      for (const organizationId of withoutStartingGrant) {
        const entry = await append(tx, {
          organizationId,
          delta: EVENT_BALANCE_DEMO_QUOTA,
          reason: 'demo_grant',
          actor: { kind: 'user', userId: operatorId },
          comment: `Demo-квота ${EVENT_BALANCE_DEMO_QUOTA} событий: группа создана без баланса (сверка 20.2.1)`,
        })
        await audit(tx, {
          operatorId,
          organizationId,
          action: 'event_balance.demo_reconciled',
          entityType: 'event_balance_entry',
          entityId: entry.id,
          newValue: {
            delta: entry.delta,
            balanceAfter: entry.balanceAfter,
            source: OPERATOR_SOURCE,
          },
        })
        demoGranted.push(organizationId)
      }
    }
    return { drift, withoutStartingGrant, unspentEvents, demoGranted }
  })
}

// ─── CLI ────────────────────────────────────────────────────────────────

export type OperatorArgs =
  | { command: 'grant' | 'correct'; org: number; units: number; operator: string; comment?: string }
  | { command: 'approve' | 'reject'; request: number; operator: string; comment?: string }
  | { command: 'reconcile'; operator: string; apply?: boolean; since?: string }

const USAGE =
  'Usage: event-balance-operator <grant|correct|approve|reject|reconcile> ' +
  '[--org <id>] [--units <n>] [--request <id>] --operator <root email> [--comment <text>] [--apply] [--since <ISO>]'

const OPTIONS: Record<string, 'int' | 'string' | 'flag'> = {
  org: 'int',
  units: 'int',
  request: 'int',
  operator: 'string',
  comment: 'string',
  since: 'string',
  apply: 'flag',
}

const REQUIRED: Record<OperatorArgs['command'], string[]> = {
  grant: ['org', 'units', 'operator'],
  correct: ['org', 'units', 'operator'],
  approve: ['request', 'operator'],
  reject: ['request', 'operator'],
  reconcile: ['operator'],
}

export function parseOperatorArgs(argv: string[]): OperatorArgs {
  const [command, ...rest] = argv
  if (!command || !(command in REQUIRED)) throw new Error(USAGE)
  const out: Record<string, unknown> = { command }
  for (let i = 0; i < rest.length; i++) {
    const name = rest[i]!.replace(/^--/, '')
    const kind = rest[i]!.startsWith('--') ? OPTIONS[name] : undefined
    if (!kind) throw new Error(`Unknown option ${rest[i]}. ${USAGE}`)
    if (kind === 'flag') {
      out[name] = true
      continue
    }
    const value = rest[++i]
    if (value === undefined) throw new Error(`Missing value for --${name}`)
    if (kind === 'int') {
      if (!/^-?\d+$/.test(value)) throw new Error(`--${name} must be an integer`)
      out[name] = Number(value)
    } else {
      out[name] = value
    }
  }
  for (const name of REQUIRED[command as OperatorArgs['command']]) {
    if (out[name] === undefined) throw new Error(`Missing --${name}. ${USAGE}`)
  }
  return out as OperatorArgs
}

export async function runOperatorCommand(database: DB, args: OperatorArgs): Promise<unknown> {
  switch (args.command) {
    case 'grant':
    case 'correct':
      return grantEventBalance(database, {
        organizationId: args.org,
        units: args.units,
        operator: args.operator,
        comment: args.comment,
        correction: args.command === 'correct',
      })
    case 'approve':
      return approvePurchaseRequest(database, {
        requestId: args.request,
        operator: args.operator,
        comment: args.comment,
      })
    case 'reject':
      return rejectPurchaseRequest(database, {
        requestId: args.request,
        operator: args.operator,
        comment: args.comment,
      })
    case 'reconcile': {
      const since = args.since ? new Date(args.since) : undefined
      if (since && Number.isNaN(since.getTime())) throw new Error('--since must be an ISO date')
      return reconcileEventBalance(database, {
        operator: args.operator,
        apply: args.apply === true,
        since,
      })
    }
  }
}

async function main(): Promise<void> {
  const args = parseOperatorArgs(process.argv.slice(2))
  const { db, closeDb } = await import('./client')
  try {
    console.log(JSON.stringify(await runOperatorCommand(db, args), null, 2))
  } finally {
    await closeDb()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
