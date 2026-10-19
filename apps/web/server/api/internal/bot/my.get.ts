import { botService } from '@volley-time/core'

/** `/my` бота: предстоящие записи пользователя. */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const { telegramId } = parseOrThrow(BotUserBody, getQuery(event))
  limitBotCall(event, telegramId)
  return { bookings: await botService.listMyBookings(telegramId) }
})
