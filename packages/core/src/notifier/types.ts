import type { KeyboardButton, NotificationType, TemplateParams } from './templates'

export interface NotifyPayload {
  telegramId: string
  text: string
  keyboard?: KeyboardButton[][]
}

/** Транспорт доставки (HTTP в bot / mock в тестах). */
export interface NotifierTransport {
  send: (payload: NotifyPayload) => Promise<void>
}

/** Уведомление, собранное внутри транзакции для отправки после коммита. */
export interface PendingNotification {
  userId: number
  type: NotificationType
  params: TemplateParams
  /**
   * Ключ дедупликации ленты (`<тип>:…:user:<id>`, 20.3.2). Для типов события выводится из
   * `params.eventId`; для оплаты и заявок организатору задаётся вызывающим (ADR v3, «Лента уведомлений»).
   */
  dedupKey?: string
}
