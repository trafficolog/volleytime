import { formatEventDate } from '@volley-time/shared'
import { db, eq, organizations, users } from '@volley-time/db'

import {
  renderMessage,
  type NotificationType,
  type RenderedMessage,
  type TemplateParams,
} from './templates'
import type { NotifierTransport, NotifyPayload } from './types'

/** Транспорт по умолчанию — no-op (переопределяется в web/bot). */
let transport: NotifierTransport = {
  async send() {
    /* no-op until configured */
  },
}

/** Настроить транспорт доставки (HTTP в bot, или mock в тестах). */
export function setNotifierTransport(t: NotifierTransport): void {
  transport = t
}

export interface Notification {
  userId: number
  type: NotificationType
  params: TemplateParams
}

/** База Mini App для кнопок уведомлений. */
function webUrl(): string {
  return (process.env.NUXT_PUBLIC_WEB_URL || process.env.WEB_URL || '').replace(/\/+$/, '')
}

/**
 * Дополняет параметры перед рендером (Task 8.8.5): дата в TZ организации и deeplink кнопки.
 * Без organizationId дата остаётся как есть, кнопка не добавляется.
 */
export async function enrichParams(params: TemplateParams): Promise<TemplateParams> {
  const out: TemplateParams = { ...params }
  if (params.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, params.organizationId),
      columns: { defaultTimezone: true },
    })
    if (params.eventDate) {
      out.eventDate = formatEventDate(params.eventDate, org?.defaultTimezone ?? undefined)
    }
    const base = webUrl()
    if (base && !out.miniAppUrl) {
      if (params.target === 'payments') {
        out.miniAppUrl = `${base}/m/orgs/${params.organizationId}/payments`
      } else if (params.target === 'subscriptions') {
        out.miniAppUrl = `${base}/m/orgs/${params.organizationId}/subscriptions`
      } else if (params.eventId) {
        out.miniAppUrl = `${base}/m/?startapp=event_${params.eventId}`
      } else {
        out.miniAppUrl = `${base}/m/orgs/${params.organizationId}`
      }
    }
  }
  return out
}

export const notifierService = {
  /**
   * Доставить уведомление с ошибкой наружу (планировщик 20.3.1 повторяет с backoff).
   * `false` — у пользователя нет Telegram (повтор бессмыслен); сбой транспорта — исключение.
   */
  async deliver(
    userId: number,
    type: NotificationType,
    params: TemplateParams = {},
  ): Promise<boolean> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { telegramUserId: true },
    })
    if (!user?.telegramUserId) return false
    const rendered = renderMessage(type, await enrichParams(params))
    await transport.send({
      telegramId: String(user.telegramUserId),
      text: rendered.text,
      keyboard: rendered.keyboard,
    })
    return true
  },

  /**
   * Сообщение в групповой чат (20.3.4): `chatId` — Telegram id чата. Ошибка доставки пробрасывается
   * (`DeliveryError` с причиной недоступности чата): вызывающий отвечает организатору и помечает
   * привязку недействительной.
   */
  async sendToChat(chatId: string, message: RenderedMessage): Promise<void> {
    await transport.send({ telegramId: chatId, text: message.text, keyboard: message.keyboard })
  },

  /**
   * Отправить уведомление пользователю (fire-and-forget).
   * Ошибки логируются, НЕ пробрасываются — доставка не должна ломать бизнес-операцию.
   * ВАЖНО: вызывать ПОСЛЕ коммита транзакции (collect-then-notify).
   */
  async send(
    userId: number,
    type: NotificationType,
    params: TemplateParams = {},
  ): Promise<boolean> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { telegramUserId: true },
      })
      if (!user?.telegramUserId) return false // нет Telegram — тихо пропускаем

      const rendered = renderMessage(type, await enrichParams(params))
      const payload: NotifyPayload = {
        telegramId: String(user.telegramUserId),
        text: rendered.text,
        keyboard: rendered.keyboard,
      }
      await transport.send(payload)
      return true
    } catch (e) {
      console.error('[notifier] send failed', { userId, type, error: e })
      return false
    }
  },

  /** Отправить пачку уведомлений параллельно (не падает на отдельных ошибках). */
  async sendMany(notifications: Notification[]): Promise<number> {
    const results = await Promise.allSettled(
      notifications.map((n) => this.send(n.userId, n.type, n.params)),
    )
    return results.filter((r) => r.status === 'fulfilled' && r.value).length
  },
}
