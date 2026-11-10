import type { Api } from 'grammy'

/**
 * Состояние бота для привязанного чата (21.4.6), ответ `POST /internal/chat-info`. Webhook:
 * `not_used` — бот в polling (штатный режим production), `ok`/`error` — webhook включён и здоров/нет,
 * `unavailable` — Telegram не ответил. Адрес webhook (в нём секретный путь) и тексты ошибок
 * Telegram наружу не уходят.
 */
export interface ChatInfo {
  memberCount: number | null
  webhook: {
    state: 'not_used' | 'ok' | 'error' | 'unavailable'
    pendingUpdateCount: number | null
  }
}

/** Свежая ошибка доставки webhook, о которой сообщает Telegram: старее — считаем исправленной. */
const WEBHOOK_ERROR_WINDOW_MS = 10 * 60_000

/** Тело запроса: id группового чата (отрицательное целое); личные чаты и пользователи не принимаются. */
export function isChatInfoRequest(v: unknown): v is { chatId: string } {
  if (!v || typeof v !== 'object') return false
  const id = (v as Record<string, unknown>).chatId
  return typeof id === 'string' && /^-\d{1,15}$/.test(id)
}

/** Число участников и состояние webhook; сбой одного вызова Telegram деградирует только своё поле. */
export async function collectChatInfo(
  api: Pick<Api, 'getChatMemberCount' | 'getWebhookInfo'>,
  chatId: string,
  mode: string,
  now: number = Date.now(),
): Promise<ChatInfo> {
  const memberCount = await api.getChatMemberCount(chatId).catch(() => null)
  if (mode !== 'webhook')
    return { memberCount, webhook: { state: 'not_used', pendingUpdateCount: null } }
  try {
    const hook = await api.getWebhookInfo()
    const freshError =
      hook.last_error_date !== undefined &&
      now - hook.last_error_date * 1000 < WEBHOOK_ERROR_WINDOW_MS
    return {
      memberCount,
      webhook: {
        state: !hook.url || freshError ? 'error' : 'ok',
        pendingUpdateCount: hook.pending_update_count,
      },
    }
  } catch {
    return { memberCount, webhook: { state: 'unavailable', pendingUpdateCount: null } }
  }
}
