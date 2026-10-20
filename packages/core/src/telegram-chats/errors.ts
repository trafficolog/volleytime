/**
 * Ошибки привязки Telegram-чата и анонса в чат (20.3.4); статусы — `CODE_STATUS` в
 * apps/web/server/utils/handle-errors.ts. Сообщения не содержат токенов, кодов и внутренних данных.
 */
export class TelegramChatError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'TelegramChatError'
  }
}

/** У группы уже есть не отвязанный чат (в том числе недействительный): сначала отвязать. */
export class TelegramChatGroupHasChatError extends TelegramChatError {
  constructor() {
    super('telegram_chat.group_has_chat', 'The group already has a linked Telegram chat')
  }
}

/** У группы нет привязанного чата. */
export class TelegramChatNotLinkedError extends TelegramChatError {
  constructor() {
    super('telegram_chat.not_linked', 'No Telegram chat is linked to this group')
  }
}

/** Привязка недействительна: бот исключён, лишён права писать или чат перенесён в супергруппу. */
export class TelegramChatInvalidError extends TelegramChatError {
  constructor(reason: 'bot_removed' | 'no_rights' | 'migrated') {
    super(`telegram_chat.${reason}`, `The linked Telegram chat is unavailable: ${reason}`)
  }
}

/** Анонсировать можно только опубликованное событие, которое ещё не началось. */
export class TelegramChatEventNotAnnounceableError extends TelegramChatError {
  constructor() {
    super(
      'telegram_chat.event_not_announceable',
      'Only a published event that has not started can be announced',
    )
  }
}

/** Лимит Bot API: повторить позже. */
export class TelegramChatRateLimitedError extends TelegramChatError {
  constructor() {
    super('telegram_chat.rate_limited', 'Telegram rate limit, try again later')
  }
}

/** Прочий сбой доставки (бот недоступен, таймаут). */
export class TelegramChatDeliveryFailedError extends TelegramChatError {
  constructor() {
    super('telegram_chat.delivery_failed', 'The announcement could not be delivered')
  }
}
