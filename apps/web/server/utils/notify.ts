import { createNotificationCollector, dispatchNotifications } from '@volley-time/core'
import type { PendingNotification } from '@volley-time/core'

/**
 * Обёртка collect-then-notify для endpoint:
 * создаёт коллектор, передаёт в сервис, шлёт уведомления после коммита.
 */
export async function withNotifications<T>(
  fn: (notifications: PendingNotification[]) => Promise<T>,
): Promise<T> {
  const notifications = createNotificationCollector()
  const result = await fn(notifications)
  // fire-and-forget: не ждём доставку, не роняем ответ
  void dispatchNotifications(notifications).catch((e) =>
    console.error('[notify] dispatch failed', e),
  )
  return result
}
