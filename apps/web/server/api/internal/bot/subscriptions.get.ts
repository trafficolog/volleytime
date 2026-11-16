import { botService } from '@volley-time/core'

/** Кнопка бота «Мой абонемент»: действующие абонементы пользователя в его группах (только чтение). */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const { telegramId } = parseOrThrow(BotUserBody, getQuery(event))
  limitBotCall(event, telegramId)
  return { subscriptions: await botService.listMySubscriptions(telegramId) }
})
