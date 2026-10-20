import { TelegramChatRateLimitedError } from '@volley-time/core'
import { z } from 'zod'

import { RateLimiter } from './rate-limit'

/** Лимит внутренних вызовов бота на одного Telegram-пользователя (20.3.3): защита от флуда кнопок. */
const botLimiter = new RateLimiter({ limit: 30, windowMs: 60_000 })

/**
 * Привязка чата (20.3.4): попытки подобрать код ограничены по администратору и по чату. Код ~40 бит
 * с TTL 15 минут, поэтому 10 попыток за 10 минут на человека делают перебор бессмысленным.
 */
const claimByAdminLimiter = new RateLimiter({ limit: 10, windowMs: 10 * 60_000 })
const claimByChatLimiter = new RateLimiter({ limit: 20, windowMs: 10 * 60_000 })
/** Действия организатора с чатом группы (выдача кода, анонс) — защита от флуда. */
const orgChatLimiter = new RateLimiter({ limit: 10, windowMs: 60_000 })

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

function tooMany(
  event: Parameters<typeof requireInternalSecret>[0],
  retryAfterSeconds: number,
): never {
  setResponseHeader(event, 'retry-after', retryAfterSeconds)
  throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
}

/** Лимит попыток привязки чата по администратору и чату (после проверки секрета). */
export function limitChatLinkClaim(
  event: Parameters<typeof requireInternalSecret>[0],
  adminTelegramId: string,
  chatId: string,
) {
  const a = claimByAdminLimiter.check(adminTelegramId)
  if (!a.allowed) tooMany(event, a.retryAfterSeconds)
  const c = claimByChatLimiter.check(chatId)
  if (!c.allowed) tooMany(event, c.retryAfterSeconds)
}

/** Лимит действий организатора с чатом группы: ключ вида `code:<orgId>` / `announce:<orgId>`. */
export function limitOrgChatAction(
  event: Parameters<typeof requireInternalSecret>[0],
  key: string,
) {
  const r = orgChatLimiter.check(key)
  if (!r.allowed) {
    // код `telegram_chat.rate_limited` (429), как у лимита Bot API
    setResponseHeader(event, 'retry-after', r.retryAfterSeconds)
    throw new TelegramChatRateLimitedError()
  }
}

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value)
  if (!r.success) throw createError({ statusCode: 422, statusMessage: 'Invalid payload' })
  return r.data
}
