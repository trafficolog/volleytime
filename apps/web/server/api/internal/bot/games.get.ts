import { botService } from '@volley-time/core'

/** `/games` бота: ближайшие события групп пользователя. Внутренний секрет, лимит по telegramId. */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const { telegramId } = parseOrThrow(BotUserBody, getQuery(event))
  limitBotCall(event, telegramId)
  return { games: await botService.listGames(telegramId) }
})
