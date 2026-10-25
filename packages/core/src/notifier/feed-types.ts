import type { notificationTypeEnum } from '@volley-time/db'

import type { NotificationType } from './templates'

/** Тип записи ленты (enum `notification_type`, ADR v3 «Лента уведомлений»). */
export type FeedType = (typeof notificationTypeEnum.enumValues)[number]

/**
 * Какие шаблоны Telegram попадают в хранимую ленту (20.3.2) и под каким типом. Прочие шаблоны —
 * мгновенные ответы на собственное действие игрока (запись, лист ожидания, бронь): в ленту не пишутся
 * и уходят прямой отправкой 8.4.
 */
export const FEED_TYPE: Partial<Record<NotificationType, FeedType>> = {
  booking_opened: 'booking_opened',
  waitlist_offer: 'waitlist_offer',
  waitlist_offer_expired: 'waitlist_offer_expired',
  reminder_24h: 'reminder_24h',
  reminder_2h: 'reminder_2h',
  split_price_settled: 'split_settled',
  split_settled_organizer: 'split_settled',
  payment_confirmed: 'payment_confirmed',
  payment_rejected: 'payment_rejected',
  payment_pending_organizer: 'organizer_action_required',
  // запрос приглашения — действие организатора; ответ игроку в ленту не пишется (прямая отправка)
  invite_request_organizer: 'organizer_action_required',
  event_cancelled: 'event_cancelled',
}

/**
 * Критичные уведомления: от них зависит участие или деньги игрока. Они не откладываются тихими
 * часами и не отключаются ни игроком, ни настройкой группы (21.2.14 «обязательные уведомления»).
 */
const CRITICAL: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'waitlist_offer',
  'payment_confirmed',
  'payment_rejected',
  'event_cancelled',
])

export const isCriticalNotification = (type: NotificationType): boolean => CRITICAL.has(type)

/**
 * Ключ дедупликации записи ленты, `UNIQUE (recipient_user_id, dedup_key)`: «не больше одного
 * уведомления одного типа на событие». Берётся из ключа задачи журнала без суффикса получателя и с
 * типом ленты в начале (`reminder_24h:event:7`). Организатору фиксации сбора — отдельный ключ, чтобы
 * организатор-участник получил оба сообщения.
 */
export function feedKeyOf(type: NotificationType, dedupKey: string): string {
  const base = dedupKey.replace(/:user:\d+$/, '')
  const rest = base.startsWith(`${type}:`) ? base.slice(type.length + 1) : base
  return `${FEED_TYPE[type]}:${rest}${type === 'split_settled_organizer' ? ':organizer' : ''}`
}

/** Ключ журнала для уведомления события без явного ключа: один тип на событие и получателя. */
export const eventDedupKey = (type: NotificationType, eventId: number, userId: number): string =>
  `${type}:event:${eventId}:user:${userId}`
