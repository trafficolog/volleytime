import { botService } from '@volley-time/core'

/** Кнопка бота «Не смогу»: отмена своей записи; повтор безопасен. Права проверяет сервис. */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const { telegramId, eventId } = parseOrThrow(BotActionBody, await readBody(event))
  limitBotCall(event, telegramId)
  const result = await withNotifications((notifications) =>
    botService.cancelMyBooking(telegramId, eventId, notifications),
  )
  return { result }
})
