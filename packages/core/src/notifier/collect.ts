import type { ServiceContext } from '../shared/context'

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

/**
 * Отправить собранные уведомления. Fire-and-forget.
 * Вызывать ПОСЛЕ коммита (вне транзакции).
 */
export async function dispatchNotifications(notifications: PendingNotification[]): Promise<number> {
  if (notifications.length === 0) return 0
  return notifierService.sendMany(notifications)
}
