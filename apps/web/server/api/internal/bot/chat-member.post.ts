import { ChatMembershipInput, telegramChatService } from '@volley-time/core'

/**
 * `my_chat_member` бота в групповом чате (20.3.4): добавление, удаление, смена прав. Обновляет
 * только существующую привязку; секрет проверяется раньше разбора тела.
 */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const body = parseOrThrow(ChatMembershipInput, await readBody(event))
  limitBotCall(event, `chat${body.chatId}`)
  return telegramChatService.syncBotMembership(body)
})
