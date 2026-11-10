import { z } from 'zod'

/**
 * Живое состояние бота для привязанного чата (21.4.6). Источник — бот (`getChatMemberCount`,
 * `getWebhookInfo`), web получает его по внутреннему каналу под секретом. Состояние webhook:
 * `not_used` — бот работает в polling (штатный режим), `ok`/`error` — webhook включён и здоров/нет,
 * `unavailable` — бот не ответил. Адрес webhook и токены в контракт не входят.
 */
export const BotChatInfoSchema = z.object({
  memberCount: z.number().int().nonnegative().nullable(),
  webhook: z.object({
    state: z.enum(['not_used', 'ok', 'error', 'unavailable']),
    pendingUpdateCount: z.number().int().nonnegative().nullable(),
  }),
})
export type BotChatInfo = z.infer<typeof BotChatInfoSchema>

export interface BotChatInfoTransport {
  /** Ответ бота на `POST /internal/chat-info` как есть; валидируется здесь. */
  chatInfo: (chatId: string) => Promise<unknown>
}

const UNAVAILABLE: BotChatInfo = {
  memberCount: null,
  webhook: { state: 'unavailable', pendingUpdateCount: null },
}

let transport: BotChatInfoTransport | null = null

/** Настроить канал к боту (HTTP в web, mock в тестах); `null` — не настроен. */
export function setBotChatInfoTransport(t: BotChatInfoTransport | null): void {
  transport = t
}

/** Состояние бота для чата; сбой бота или чужой формат ответа — «недоступно», не ошибка. */
export async function loadBotChatInfo(chatId: string): Promise<BotChatInfo> {
  if (!transport) return UNAVAILABLE
  try {
    return BotChatInfoSchema.parse(await transport.chatInfo(chatId))
  } catch {
    return UNAVAILABLE
  }
}
