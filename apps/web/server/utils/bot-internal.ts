import { z } from 'zod'

import { RateLimiter } from './rate-limit'

/** Лимит внутренних вызовов бота на одного Telegram-пользователя (20.3.3): защита от флуда кнопок. */
const botLimiter = new RateLimiter({ limit: 30, windowMs: 60_000 })

export const TelegramIdParam = z.string().regex(/^\d{1,15}$/)
export const BotActionBody = z.object({
  telegramId: TelegramIdParam,
  eventId: z.number().int().positive().max(2_147_483_647),
})
export const BotUserBody = z.object({ telegramId: TelegramIdParam })

/** Лимит по Telegram id (после проверки секрета: чужие запросы лимит не расходуют). */
export function limitBotCall(
  event: Parameters<typeof requireInternalSecret>[0],
  telegramId: string,
) {
  const r = botLimiter.check(telegramId)
  if (!r.allowed) {
    setResponseHeader(event, 'retry-after', r.retryAfterSeconds)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
  }
}

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value)
  if (!r.success) throw createError({ statusCode: 422, statusMessage: 'Invalid payload' })
  return r.data
}
