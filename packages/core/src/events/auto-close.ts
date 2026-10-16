import {
  and,
  bookings,
  db as defaultDb,
  eq,
  events,
  gt,
  inArray,
  lt,
  scheduledJobs,
  sql,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { revokeEventOffers } from '../bookings/offers'
import type { PendingNotification } from '../notifier/types'
import { enqueueNotification } from '../scheduler/journal'
import { systemContext } from '../shared/context'

import { closeMomentOf, isAutoCloseCandidate, noManualCloseSql } from './booking-close'
import { EventError } from './errors'
import { settleLockedEvent } from './pricing-service'

export interface CloseSummary {
  closed: number
  settled: number
  skipped: number
}

/** Проходов с временным сбоем закрытия, после которых событие отдаётся организатору. */
export const CLOSE_RETRY_LIMIT = 5

/** Счётчик временных сбоев закрытия события в журнале; возвращает число сбоев с этим. */
async function countCloseRetry(eventId: number, now: Date, e: unknown): Promise<number> {
  const message = (e instanceof Error ? e.message : String(e)).slice(0, 500)
  const [row] = await defaultDb.execute(sql`
    INSERT INTO ${scheduledJobs} (kind, dedup_key, event_id, status, attempts, run_at, completed_at, last_error)
    VALUES ('event.close_retry', ${`event.close_retry:event:${eventId}`}, ${eventId}, 'skipped', 1,
      ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz, ${message})
    ON CONFLICT (dedup_key) DO UPDATE
      SET attempts = ${scheduledJobs}.attempts + 1, last_error = EXCLUDED.last_error,
        completed_at = EXCLUDED.completed_at
    RETURNING attempts`)
  return Number(row!.attempts)
}

/** Метка журнала «split не зафиксирован автоматически»: событие больше не пробуется, тревога — одна. */
const closeSkippedKey = (eventId: number) => `event.close_skipped:event:${eventId}`

/**
 * Закрытие записи по расписанию (20.3.1): в момент закрытия (начало − `close_before_minutes`,
 * решение владельца 2026-10-16) опубликованное событие переходит в `closed`. Только события, которые
 * были опубликованы и открыты до этого момента: событие, ставшее открытым уже после него (создано,
 * опубликовано или переоткрыто в окне), несёт метку ручного закрытия (`syncManualCloseMark`) и его
 * ведёт организатор; правки после момента закрытия право планировщика не меняют. Начавшиеся события не трогаются.
 * Split: если к моменту закрытия в событии нет участников, оно закрывается без фиксации — без
 * начислений и долей; с участниками доли фиксируются один раз тем же путём, что ручная фиксация
 * (ручная остаётся). Split, который нельзя зафиксировать (цель меньше числа мест, несовместимая
 * оплата), помечается в журнале и больше не пробуется; тревога в лог — один раз.
 * Каждое событие — отдельная транзакция под его advisory-lock; повтор и параллельные экземпляры
 * безопасны.
 */
export async function closeDueEvents(now: Date, limit = 100): Promise<CloseSummary> {
  const summary: CloseSummary = { closed: 0, settled: 0, skipped: 0 }
  const closeAt = sql`${events.startsAt} - make_interval(mins => ${events.closeBeforeMinutes})`
  const due = await defaultDb
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.status, 'published'),
        gt(events.startsAt, now),
        sql`${closeAt} <= ${now.toISOString()}::timestamptz`,
        sql`(${events.bookingOpensAt} IS NULL OR ${events.bookingOpensAt} <= ${closeAt})`,
        noManualCloseSql(events.id),
        sql`NOT EXISTS (SELECT 1 FROM ${scheduledJobs} j
          WHERE j.dedup_key = 'event.close_skipped:event:' || ${events.id})`,
      ),
    )
    .orderBy(events.startsAt, events.id)
    .limit(limit)
  for (const { id } of due) {
    try {
      const outcome = await defaultDb.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${id})`)
        const [event] = await tx.select().from(events).where(eq(events.id, id)).for('update')
        if (
          !event ||
          !isAutoCloseCandidate(event) ||
          event.startsAt <= now ||
          closeMomentOf(event) > now
        )
          return 'skipped' as const
        // метка ручного закрытия могла появиться между выборкой и lock (переоткрытие в окне)
        const [manual] = await tx
          .select({ id: events.id })
          .from(events)
          .where(and(eq(events.id, id), noManualCloseSql(events.id)))
        if (!manual) return 'skipped' as const
        const notifications: PendingNotification[] = []
        const ctx = { ...systemContext(tx), notifications }
        let settled = false
        if (event.priceMode === 'split' && event.pricingSettledAt === null) {
          // участники, записавшиеся до момента закрытия: пустой к этому моменту split не фиксируется
          const [row] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(bookings)
            .where(
              and(
                eq(bookings.eventId, id),
                inArray(bookings.status, ['confirmed', 'pending_payment']),
                lt(bookings.bookedAt, closeMomentOf(event)),
              ),
            )
          if ((row?.n ?? 0) > 0) {
            await settleLockedEvent(ctx, event) // закрывает запись и снимает предложения
            settled = true
          }
        }
        if (!settled) {
          await revokeEventOffers(tx, id, now)
          await tx
            .update(events)
            .set({ status: 'closed', updatedAt: now })
            .where(and(eq(events.id, id), eq(events.status, 'published')))
        }
        await auditService.record(ctx, {
          organizationId: event.organizationId,
          action: AUDIT_ACTIONS.EVENT_BOOKING_CLOSED,
          entityType: 'event',
          entityId: id,
          newValue: { status: 'closed', settled, source: 'scheduler:event.close' },
        })
        // уведомления фиксации split — через журнал (повтор при сбое бота, без дублей)
        for (const n of notifications)
          await enqueueNotification(tx, {
            type: n.type,
            dedupKey: `${n.type}:event:${id}:user:${n.userId}`,
            organizationId: event.organizationId,
            eventId: id,
            userId: n.userId,
            params: n.params,
            runAt: now,
          })
        return settled ? ('settled' as const) : ('closed' as const)
      })
      summary[outcome]++
    } catch (e) {
      summary.skipped++
      // временные сбои (deadlock, таймаут, соединение) повторяются следующим проходом; метка —
      // только для доменного отказа фиксации (цель меньше мест, несовместимая оплата)
      // временный сбой повторяется, но не бесконечно: после CLOSE_RETRY_LIMIT проходов — метка и тревога
      if (!(e instanceof EventError) && (await countCloseRetry(id, now, e)) < CLOSE_RETRY_LIMIT) {
        console.warn('[scheduler] auto-close deferred to the next tick', { eventId: id, error: e })
        continue
      }
      // метка — отдельной строкой после отката транзакции события; повтор не вставит вторую
      const marked = await defaultDb
        .insert(scheduledJobs)
        .values({
          kind: 'event.close_skipped',
          dedupKey: closeSkippedKey(id),
          eventId: id,
          status: 'skipped',
          runAt: now,
          completedAt: now,
          lastError: (e instanceof Error ? e.message : String(e)).slice(0, 500),
        })
        .onConflictDoNothing({ target: scheduledJobs.dedupKey })
        .returning({ id: scheduledJobs.id })
      if (marked.length > 0)
        console.error('[scheduler] auto-close failed; organizer must close the event', {
          eventId: id,
          error: e,
        })
    }
  }
  return summary
}
