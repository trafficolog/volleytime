import { botService } from '@volley-time/core'

/** Кнопка бота «Кто уже играет»: состав события для участника его группы (только чтение). */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const { telegramId, eventId } = parseOrThrow(BotActionBody, await readBody(event))
  limitBotCall(event, telegramId)
  return botService.eventRoster(telegramId, eventId)
})
