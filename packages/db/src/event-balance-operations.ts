/**
 * Операции root с балансом событий (20.2.1, 22.2.3): начисление, исправление, решения по заявкам,
 * сверка. Общая логика операторской команды (`event-balance-operator.ts`) и Root Admin
 * (packages/core `platformPurchaseRequestsService`). Модуль без побочных эффектов при импорте:
 * CLI-обвязка живёт в `event-balance-operator.ts` и сюда не входит.
 */
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
  platformStaff,
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
/** Максимум int4: id вне диапазона не уходят в запрос к БД. */
export const INT4_MAX = 2_147_483_647
export const isDbId = (n: number) => Number.isSafeInteger(n) && n > 0 && n <= INT4_MAX

/** Предел одной операции начисления/исправления: защита от опечатки в --units. */
export const OPERATOR_MAX_UNITS = 1000

/** Оператор: ровно одно из `operator` (email) и `operatorId` (users.id). */
export interface OperatorRef {
  operator?: string
  operatorId?: number
}

async function resolveOperator(db: DbOrTx, ref: OperatorRef): Promise<number> {
  const hasEmail = ref.operator !== undefined
  const hasId = ref.operatorId !== undefined
  if (hasEmail === hasId) {
    throw new OperatorError(
      hasEmail ? 'operator.ambiguous' : 'operator.required',
      'Specify exactly one of --operator <email> and --operator-id <users.id>',
    )
  }
  if (hasId && !isDbId(ref.operatorId!)) {
    throw new OperatorError('operator.invalid_id', '--operator-id must be a positive integer')
  }
  // 29.3.1 (R-15): оператор — член команды платформы с правом на баланс (Owner, Admin, Finance)
  const [user] = await db
    .select({ id: users.id, role: platformStaff.role, isActive: users.isActive })
    .from(users)
    .leftJoin(platformStaff, eq(platformStaff.userId, users.id))
    .where(
      hasId
        ? eq(users.id, ref.operatorId!)
        : sql`lower(${users.email}) = lower(${ref.operator!.trim()})`,
    )
  if (!user || !user.isActive || !BALANCE_OPERATOR_ROLES.includes(user.role ?? '')) {
    throw new OperatorError(
      'forbidden.root_only',
      `Operator ${hasId ? `id ${ref.operatorId}` : ref.operator} is not an active root admin`,
    )
  }
  return user.id
}

const BALANCE_OPERATOR_ROLES: string[] = ['owner', 'admin', 'finance']

function requireComment(comment: string | undefined): string {
  const value = comment?.trim()
  if (!value)
    throw new OperatorError('operator.comment_required', 'A non-empty --comment is required')
  return value
}

async function requireOrganization(db: DbOrTx, organizationId: number): Promise<void> {
  if (!isDbId(organizationId)) {
    throw new OperatorError('organization.not_found', `No organization ${organizationId}`)
  }
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
    comment?: string
    correction?: boolean
  } & OperatorRef,
): Promise<EventBalanceEntry> {
  const comment = requireComment(params.comment)
  const valid = params.correction
    ? Number.isSafeInteger(params.units) && params.units !== 0
    : Number.isSafeInteger(params.units) && params.units > 0
  if (!valid || Math.abs(params.units) > OPERATOR_MAX_UNITS) {
    throw new OperatorError(
      'operator.invalid_units',
      params.correction
        ? `--units must be a non-zero integer within ±${OPERATOR_MAX_UNITS}`
        : `--units must be a positive integer up to ${OPERATOR_MAX_UNITS}`,
    )
  }
  return database.transaction(async (tx) => {
    const operatorId = await resolveOperator(tx, params)
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
  if (!isDbId(requestId)) {
    throw new OperatorError('purchase_request.not_found', `No purchase request ${requestId}`)
  }
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
    .set({
      status,
      decidedByUserId: operatorId,
      // время транзакции, как у created_at записи журнала: период выгрузки и сверки совпадает
      decidedAt: sql`now()`,
      decisionComment: comment,
    })
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
  database: DbOrTx,
  params: { requestId: number; comment?: string; source?: string } & OperatorRef,
): Promise<{ request: EventBalancePurchaseRequest; entry: EventBalanceEntry }> {
  const comment = params.comment?.trim() || null
  return database.transaction(async (tx) => {
    const operatorId = await resolveOperator(tx, params)
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
        source: params.source ?? OPERATOR_SOURCE,
      },
    })
    return { request, entry }
  })
}

/** Отклонить заявку (с причиной); баланс не меняется. */
export async function rejectPurchaseRequest(
  database: DbOrTx,
  params: { requestId: number; comment?: string; source?: string } & OperatorRef,
): Promise<EventBalancePurchaseRequest> {
  const comment = requireComment(params.comment)
  return database.transaction(async (tx) => {
    const operatorId = await resolveOperator(tx, params)
    await lockPendingRequest(tx, params.requestId)
    const request = await decide(tx, params.requestId, 'rejected', operatorId, comment)
    await audit(tx, {
      operatorId,
      organizationId: request.organizationId,
      action: 'event_balance.purchase_rejected',
      entityType: 'event_balance_purchase_request',
      entityId: request.id,
      oldValue: { status: 'pending' },
      newValue: { status: 'rejected', comment, source: params.source ?? OPERATOR_SOURCE },
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
  params: { apply: boolean; since?: Date } & OperatorRef,
): Promise<ReconcileReport> {
  return database.transaction(async (tx) => {
    const operatorId = await resolveOperator(tx, params)

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
