import { and, bookings, db as defaultDb, eq, events, gt, inArray, lte, sql } from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { revokeEventOffers } from '../bookings/offers'
import type { PendingNotification } from '../notifier/types'
import { enqueueNotification } from '../scheduler/journal'
import { systemContext } from '../shared/context'

import { settleLockedEvent } from './pricing-service'

/** Запись закрывается за 2 ч до начала (входная карточка 15.4.1; совпадает с напоминанием 2 ч). */
export const CLOSE_BEFORE_START_MS = 2 * 3600_000

export interface CloseSummary {
  closed: number
  settled: number
  skipped: number
}

/**
 * Закрытие записи по расписанию (20.3.1): опубликованные события, до начала которых осталось не
 * больше 2 ч, переходят в `closed`; split-событие при этом фиксирует доли (тот же путь, что ручная
 * фиксация, — ручная остаётся). Начавшиеся события не трогаются: пропущенное окно (планировщик был
 * выключен) не закрывает задним числом и не создаёт платежи за прошедшие события.
 * Каждое событие — отдельная транзакция под его advisory-lock; переход условный, повтор и
 * параллельные экземпляры безопасны. Split, который нельзя зафиксировать (нет участников, цель
 * меньше числа мест), остаётся организатору.
 */
export async function closeDueEvents(now: Date, limit = 100): Promise<CloseSummary> {
  const summary: CloseSummary = { closed: 0, settled: 0, skipped: 0 }
  const horizon = new Date(now.getTime() + CLOSE_BEFORE_START_MS)
  const due = await defaultDb
    .select({ id: events.id })
    .from(events)
    .where(
      and(eq(events.status, 'published'), gt(events.startsAt, now), lte(events.startsAt, horizon)),
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
          event.status !== 'published' ||
          event.startsAt <= now ||
          event.startsAt > horizon
        )
          return 'skipped' as const
        const notifications: PendingNotification[] = []
        const ctx = { ...systemContext(tx), notifications }
        if (event.priceMode === 'split' && event.pricingSettledAt === null) {
          const [row] = await tx
            .select({
              seats: sql<number>`coalesce(sum(${bookings.seats}), 0)::int`,
            })
            .from(bookings)
            .where(
              and(
                eq(bookings.eventId, id),
                inArray(bookings.status, ['confirmed', 'pending_payment']),
              ),
            )
          const seats = row?.seats ?? 0
          if (seats === 0 || event.targetAmount! < seats) return 'skipped' as const
          await settleLockedEvent(ctx, event)
        } else {
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
          newValue: { status: 'closed', source: 'scheduler:event.close' },
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
        return event.priceMode === 'split' ? ('settled' as const) : ('closed' as const)
      })
      summary[outcome]++
    } catch (e) {
      summary.skipped++
      console.error('[scheduler] auto-close failed', { eventId: id, error: e })
    }
  }
  return summary
}
