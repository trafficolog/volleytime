import { and, eq, sql } from 'drizzle-orm'

import type { DbOrTx } from './client'
import {
  eventBalanceEntries,
  organizationEventBalances,
  type EventBalanceEntry,
  type EventBalanceReason,
} from './schema'

/**
 * Единственная точка изменения баланса событий (20.2.1, ADR v3 «Баланс событий», шаги 2, 4, 5).
 * Используется сервисом `event-balance` (packages/core), операторской командой и demo-сидом.
 * Вызывать ТОЛЬКО внутри транзакции: блокировка строки проекции держится до её конца.
 * Порядок блокировок (ADR, принцип 7): advisory-lock события (если операция касается события) —
 * у вызывающего, затем строка проекции — здесь, затем платежи/абонементы.
 */

/** Demo-квота новой группы (handoff, D-12) и стартовый баланс пилотной группы (D-12). */
export const EVENT_BALANCE_DEMO_QUOTA = 5
export const EVENT_BALANCE_PILOT_GRANT = 48

export type EventBalanceActorInput =
  { kind: 'user'; userId: number } | { kind: 'system'; source: string }

export interface EventBalanceEntryInput {
  organizationId: number
  delta: number
  reason: EventBalanceReason
  actor: EventBalanceActorInput
  eventId?: number | null
  purchaseRequestId?: number | null
  comment?: string | null
}

/** Списание больше остатка: баланс никогда не уходит в минус. */
export class EventBalanceInsufficientError extends Error {
  readonly code = 'event_balance.insufficient'
  constructor() {
    super('Недостаточно баланса событий')
    this.name = 'EventBalanceInsufficientError'
  }
}

/**
 * Заблокировать строку проекции (SELECT … FOR UPDATE) и вернуть текущий баланс. Строки нет
 * (организация создана runtime без баланса, правило совместимости 5) — лениво создать с 0 и
 * повторить блокировку; это единственное допустимое ON CONFLICT DO NOTHING — журнал оно не трогает.
 */
export async function lockEventBalance(db: DbOrTx, organizationId: number): Promise<number> {
  const select = () =>
    db
      .select({ balance: organizationEventBalances.balance })
      .from(organizationEventBalances)
      .where(eq(organizationEventBalances.organizationId, organizationId))
      .for('update')
  let [row] = await select()
  if (!row) {
    await db
      .insert(organizationEventBalances)
      .values({ organizationId, balance: 0 })
      .onConflictDoNothing({ target: organizationEventBalances.organizationId })
    ;[row] = await select()
  }
  return row!.balance
}

/**
 * Провести операцию: блокировка проекции → условный UPDATE (balance + delta >= 0) → строка журнала
 * с balance_after. Нарушение частичного UNIQUE журнала — ошибка и откат всей транзакции вызывающего
 * (никогда не ON CONFLICT DO NOTHING): иначе проекция изменилась бы без записи журнала.
 */
export async function appendEventBalanceEntry(
  db: DbOrTx,
  input: EventBalanceEntryInput,
): Promise<EventBalanceEntry> {
  if (!Number.isSafeInteger(input.delta) || input.delta === 0) {
    throw new Error('Event balance delta must be a non-zero integer')
  }
  await lockEventBalance(db, input.organizationId)
  const [updated] = await db
    .update(organizationEventBalances)
    .set({
      balance: sql`${organizationEventBalances.balance} + ${input.delta}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(organizationEventBalances.organizationId, input.organizationId),
        sql`${organizationEventBalances.balance} + ${input.delta} >= 0`,
      ),
    )
    .returning({ balance: organizationEventBalances.balance })
  if (!updated) throw new EventBalanceInsufficientError()

  const [entry] = await db
    .insert(eventBalanceEntries)
    .values({
      organizationId: input.organizationId,
      delta: input.delta,
      reason: input.reason,
      balanceAfter: updated.balance,
      eventId: input.eventId ?? null,
      purchaseRequestId: input.purchaseRequestId ?? null,
      actorKind: input.actor.kind,
      createdByUserId: input.actor.kind === 'user' ? input.actor.userId : null,
      source: input.actor.kind === 'system' ? input.actor.source : null,
      comment: input.comment ?? null,
    })
    .returning()
  return entry!
}

/** Есть ли в журнале строка с этой причиной по событию (под блокировкой проекции — точно). */
export async function hasEventBalanceEntryForEvent(
  db: DbOrTx,
  eventId: number,
  reason: 'spend' | 'refund',
): Promise<boolean> {
  const [row] = await db
    .select({ id: eventBalanceEntries.id })
    .from(eventBalanceEntries)
    .where(and(eq(eventBalanceEntries.eventId, eventId), eq(eventBalanceEntries.reason, reason)))
    .limit(1)
  return !!row
}

/** Есть ли у организации стартовое начисление (demo_grant или pilot_grant, правило совместимости 5). */
export async function hasStartingGrant(db: DbOrTx, organizationId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: eventBalanceEntries.id })
    .from(eventBalanceEntries)
    .where(
      and(
        eq(eventBalanceEntries.organizationId, organizationId),
        sql`${eventBalanceEntries.reason} IN ('demo_grant', 'pilot_grant')`,
      ),
    )
    .limit(1)
  return !!row
}
