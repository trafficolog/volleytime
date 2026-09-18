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
}
