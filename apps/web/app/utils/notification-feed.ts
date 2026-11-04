import { formatTime } from '@volley-time/shared'

import { formatPrice } from './labels'

/** Запись ленты `GET /api/notifications` (20.3.2): дата приходит строкой ISO. */
export interface FeedNotification {
  id: number
  type:
    | 'booking_opened'
    | 'waitlist_offer'
    | 'waitlist_offer_expired'
    | 'reminder_24h'
    | 'reminder_2h'
    | 'split_settled'
    | 'payment_confirmed'
    | 'payment_rejected'
    | 'lineup_ready'
    | 'mvp_vote'
    | 'event_cancelled'
    | 'organizer_action_required'
  organizationId: number | null
  eventId: number | null
  /** `{ template, params }` — параметры шаблона уведомления (без секретов). */
  payload: unknown
  readAt: string | null
  createdAt: string
}

export type NotificationTone = 'flame' | 'grass' | 'amber' | 'rose' | 'ink'

export interface NotificationView {
  title: string
  body: string
  icon: string
  tone: NotificationTone
  /** Куда ведёт карточка; без события и цели — на главную группы. */
  to: string
}

interface Params {
  eventTitle?: string
  eventDate?: string
  planName?: string
  /** Сбор, в который внесён взнос (21.2.4). */
  collectionTitle?: string
  playerName?: string
  amount?: number
  targetAmount?: number
  currency?: string
  refunded?: boolean
  target?: string
  /** Запрос приглашения на событие (20.4.7), а не заявка на оплату. */
  inviteRequest?: boolean
  /** Игрок отозвал запрос: запись ленты уже не требует действия (20.4.7). */
  inviteRequestWithdrawn?: boolean
}

function paramsOf(payload: unknown): Params {
  if (typeof payload !== 'object' || payload === null) return {}
  const params = (payload as { params?: unknown }).params
  return typeof params === 'object' && params !== null ? (params as Params) : {}
}

const joinText = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

/**
 * Вид записи ленты: заголовок, текст, иконка и переход. Тексты согласованы с шаблонами бота
 * (`renderMessage`, 20.3.2): лента и Telegram — один источник, разные носители. Данные
 * только из `payload`; неполная нагрузка даёт нейтральный текст без `undefined`.
 */
export function notificationView(n: FeedNotification, base: string): NotificationView {
  const p = paramsOf(n.payload)
  const event = p.eventTitle?.trim() || 'событие'
  const quoted = p.eventTitle?.trim() ? `«${p.eventTitle.trim()}»` : 'событие'
  const to =
    p.target === 'subscriptions'
      ? `${base}/subscriptions`
      : p.target === 'payments'
        ? `${base}/payments`
        : n.eventId
          ? `${base}/events/${n.eventId}`
          : base

  switch (n.type) {
    case 'booking_opened':
      return {
        title: 'Запись открыта',
        body: joinText(event, p.eventDate && `· ${p.eventDate}`),
        icon: 'calendar',
        tone: 'flame',
        to,
      }
    case 'waitlist_offer':
      return {
        title: 'Освободилось место',
        body: `${quoted}. Подтвердите участие в течение 30 мин — иначе место уйдёт следующему.`,
        icon: 'bell',
        tone: 'amber',
        to,
      }
    case 'waitlist_offer_expired':
      return {
        title: 'Предложение места истекло',
        body: `${quoted}. Место передано следующему в очереди.`,
        icon: 'clock',
        tone: 'ink',
        to,
      }
    case 'reminder_24h':
      return {
        title: `Завтра · ${event}`,
        body: p.eventDate ?? 'Напоминание о записи',
        icon: 'clock',
        tone: 'flame',
        to,
      }
    case 'reminder_2h':
      return {
        title: `Через 2 часа · ${event}`,
        body: p.eventDate ?? 'Напоминание о записи',
        icon: 'clock',
        tone: 'flame',
        to,
      }
    case 'split_settled':
      return {
        title: 'Итоговая цена сбора',
        body:
          p.amount !== undefined
            ? `${quoted}. Ваша доля: ${formatPrice(p.amount, p.currency)}.`
            : p.targetAmount !== undefined
              ? `${quoted}. Распределено: ${formatPrice(p.targetAmount, p.currency)}.`
              : `${quoted}. Запись закрыта, доли рассчитаны.`,
        icon: 'card',
        tone: 'amber',
        to,
      }
    case 'payment_confirmed':
      return {
        title: 'Оплата подтверждена',
        body: joinText(
          p.amount !== undefined && `${formatPrice(p.amount, p.currency)}.`,
          p.planName
            ? `Абонемент «${p.planName}» активирован.`
            : p.collectionTitle
              ? `Взнос в сбор «${p.collectionTitle}».`
              : quoted,
        ),
        icon: 'check',
        tone: 'grass',
        to,
      }
    case 'payment_rejected':
      return {
        title: 'Оплата отклонена',
        body: joinText(
          p.planName
            ? `Абонемент «${p.planName}».`
            : p.collectionTitle
              ? `Взнос в сбор «${p.collectionTitle}».`
              : `${quoted}.`,
          'Свяжитесь с организатором.',
        ),
        icon: 'alert',
        tone: 'rose',
        to,
      }
    case 'event_cancelled':
      return {
        title: 'Событие отменено',
        body: joinText(
          quoted,
          p.eventDate && `· ${p.eventDate}`,
          p.refunded && '. Оплата возвращена, занятие восстановлено.',
        ).replace(' .', '.'),
        icon: 'alert',
        tone: 'rose',
        to,
      }
    case 'organizer_action_required':
      if (p.inviteRequest) {
        return {
          title: p.inviteRequestWithdrawn ? 'Запрос отозван' : 'Запрос приглашения',
          body: joinText(p.playerName && `${p.playerName} ·`, event),
          icon: 'users',
          tone: p.inviteRequestWithdrawn ? 'ink' : 'amber',
          to,
        }
      }
      return {
        title: 'Заявка на оплату',
        body: joinText(
          p.playerName,
          p.planName
            ? `· «${p.planName}»`
            : p.collectionTitle
              ? `· взнос в сбор «${p.collectionTitle}»`
              : `· ${event}`,
        ),
        icon: 'wallet',
        tone: 'amber',
        to,
      }
    case 'lineup_ready':
      return { title: 'Составы готовы', body: quoted, icon: 'users', tone: 'flame', to }
    case 'mvp_vote':
      return { title: 'Голосование за MVP', body: quoted, icon: 'check', tone: 'flame', to }
  }
}

const dayKey = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)

/** Ключ предыдущих суток: по календарю часового пояса, а не «минус 24 часа» (переход на летнее время). */
function previousDayKey(todayKey: string): string {
  const [y, m, d] = todayKey.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().slice(0, 10)
}

export interface NotificationDayGroup<T extends FeedNotification = FeedNotification> {
  day: 'Сегодня' | 'Вчера' | 'Ранее'
  items: T[]
}

/** «Сегодня / Вчера / Ранее» по суткам часового пояса группы; порядок записей сохраняется. */
export function groupNotificationsByDay<T extends FeedNotification>(
  items: readonly T[],
  tz: string,
  now = new Date(),
): NotificationDayGroup<T>[] {
  const today = dayKey(now, tz)
  const yesterday = previousDayKey(today)
  const groups: NotificationDayGroup<T>[] = []
  for (const item of items) {
    const key = dayKey(new Date(item.createdAt), tz)
    const day = key === today ? 'Сегодня' : key === yesterday ? 'Вчера' : 'Ранее'
    const last = groups.at(-1)
    if (last?.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }
  return groups
}

/** Время записи: «18:00» для сегодняшних и вчерашних, иначе «25 мая». */
export function notificationTime(
  createdAt: string,
  day: NotificationDayGroup['day'],
  tz: string,
): string {
  return day === 'Ранее'
    ? new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'long' }).format(
        new Date(createdAt),
      )
    : formatTime(createdAt, tz)
}
