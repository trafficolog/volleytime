import { and, eq, gt, isNull, or, sql, subscriptions } from '@volley-time/db'

/**
 * Действующий абонемент группы: активный, с остатком занятий, не истёкший на `now`. Единое
 * условие для обзора кабинета (21.2.18) и статистики игроков (21.2.20); списание занятий
 * (`subscriptionService.consumeSessions`) повторяет его с привязкой к игроку.
 */
export function usableSubscriptionWhere(orgId: number, now: Date) {
  return and(
    eq(subscriptions.organizationId, orgId),
    eq(subscriptions.status, 'active'),
    sql`${subscriptions.usedSessions} < ${subscriptions.totalSessions}`,
    or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now)),
  )
}
