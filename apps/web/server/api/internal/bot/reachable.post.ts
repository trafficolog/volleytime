import { botService } from '@volley-time/core'

/** Бот снова доступен (`/start`, `my_chat_member` → member): снять `users.bot_blocked_at` (20.3.2). */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const { telegramId } = parseOrThrow(BotUserBody, await readBody(event))
  limitBotCall(event, telegramId)
  return { cleared: await botService.markReachable(telegramId) }
})
