import { db } from '@volley-time/db'

import { enqueueNotifications, processDueJobs, type NotifyJobInput } from '../scheduler/journal'
import type { ServiceContext } from '../shared/context'

import { eventDedupKey, FEED_TYPE } from './feed-types'
import { notifierService } from './service'
import type { PendingNotification } from './types'

/**
 * Собрать уведомление для отправки ПОСЛЕ коммита транзакции.
 * Если коллектор не передан в ctx — no-op (сервис работает как раньше).
 */
export function collectNotification(ctx: ServiceContext, n: PendingNotification): void {
  ctx.notifications?.push(n)
}

/** Создать пустой коллектор (вызывается в endpoint перед вызовом сервиса). */
export function createNotificationCollector(): PendingNotification[] {
  return []
}

/** Бюджет немедленной доставки после коммита: недоступный бот не задерживает ответ endpoint. */
const IMMEDIATE_DELIVERY_BUDGET_MS = 3000

/**
 * Задача журнала для уведомления ленты или `null`, если шаблон в ленту не пишется либо нет ключа
 * дедупликации (событие неизвестно и ключ не задан) — такие уходят прямой отправкой 8.4.
 */
function toJob(n: PendingNotification): NotifyJobInput | null {
  if (!FEED_TYPE[n.type]) return null
  const dedupKey =
    n.dedupKey ?? (n.params.eventId ? eventDedupKey(n.type, n.params.eventId, n.userId) : null)
  if (!dedupKey) return null
  return {
    type: n.type,
    dedupKey,
    userId: n.userId,
    params: n.params,
    organizationId: n.params.organizationId ?? null,
    eventId: n.params.eventId ?? null,
  }
}

/**
 * Отправить собранные уведомления. Вызывать ПОСЛЕ коммита (вне транзакции).
 * Типы ленты (P-09) записываются в `notifications` и ставятся в журнал `scheduled_jobs` — единый
 * отправитель с повтором, лимитами Bot API, тихими часами и дедупликацией (20.3.2); сразу после
 * постановки выполняется проход доставки, остаток (повтор, тихие часы) — на планировщике 20.3.1.
 * Прочие шаблоны — прямая отправка 8.4 (fire-and-forget). Возвращает число принятых к отправке.
 */
export async function dispatchNotifications(notifications: PendingNotification[]): Promise<number> {
  if (notifications.length === 0) return 0
  const feed: NotifyJobInput[] = []
  const direct: PendingNotification[] = []
  for (const n of notifications) {
    const job = toJob(n)
    if (job) feed.push(job)
    else direct.push(n)
  }
  let accepted = direct.length > 0 ? await notifierService.sendMany(direct) : 0
  if (feed.length > 0) {
    try {
      accepted += await enqueueNotifications(db, feed)
      await processDueJobs({ budgetMs: IMMEDIATE_DELIVERY_BUDGET_MS })
    } catch (e) {
      // доставка не должна ломать бизнес-операцию; задача остаётся в журнале для планировщика
      console.error('[notifier] feed dispatch failed', e)
    }
  }
  return accepted
}
