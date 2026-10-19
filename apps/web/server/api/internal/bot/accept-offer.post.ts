import { botService } from '@volley-time/core'

/** Кнопка бота «Беру место»: принять своё предложение из листа ожидания; повтор безопасен. */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const { telegramId, eventId } = parseOrThrow(BotActionBody, await readBody(event))
  limitBotCall(event, telegramId)
  const result = await withNotifications((notifications) =>
    botService.acceptMyOffer(telegramId, eventId, notifications),
  )
  return { result }
})
