import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import { z } from 'zod'

import { LOGIN_WIDGET_MAX_AGE_SECONDS } from './settings'
import { CLOCK_SKEW_SECONDS, TelegramAuthError, type ValidatedTelegramUser } from './validate'

/** Поля, которые Telegram Login Widget передаёт в callback (все значения подписаны). */
export const LoginWidgetPayload = z
  .object({
    id: z.union([z.number(), z.string()]),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    photo_url: z.string().optional(),
    auth_date: z.union([z.number(), z.string()]),
    hash: z.string().min(1),
  })
  // Telegram может добавить поля: они входят в data-check-string, поэтому не отбрасываются.
  .catchall(z.union([z.string(), z.number(), z.boolean()]))
export type LoginWidgetPayload = z.infer<typeof LoginWidgetPayload>

const WidgetUser = z.object({
  id: z.coerce.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
})

export interface ValidatedLoginWidgetData {
  user: ValidatedTelegramUser
  auth_date: number
}

/**
 * Проверка данных Telegram Login Widget по документации Telegram:
 * data_check_string — все поля, кроме hash, `key=value`, по алфавиту, через `\n`;
 * secret_key = SHA256(bot_token) (не HMAC "WebAppData", как у Mini App);
 * hash = hex(HMAC-SHA256(data_check_string, secret_key)).
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function validateLoginWidgetData(
  payload: unknown,
  botToken: string,
  options: { maxAgeSeconds?: number } = {},
): ValidatedLoginWidgetData {
  if (!botToken || botToken.trim() === '') {
    throw new TelegramAuthError('Bot token is not configured')
  }
  const maxAgeSeconds = options.maxAgeSeconds ?? LOGIN_WIDGET_MAX_AGE_SECONDS

  const parsed = LoginWidgetPayload.safeParse(payload)
  if (!parsed.success) throw new TelegramAuthError('Invalid login widget payload')
  const { hash, ...fields } = parsed.data
  if (!/^[0-9a-f]{64}$/i.test(hash)) throw new TelegramAuthError('Invalid login widget signature')

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${String(fields[k])}`)
    .join('\n')
  const secretKey = createHash('sha256').update(botToken).digest()
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest()
  const received = Buffer.from(hash, 'hex')
  if (computed.length !== received.length || !timingSafeEqual(computed, received)) {
    throw new TelegramAuthError('Invalid login widget signature')
  }

  const authDate = Number(fields.auth_date)
  if (!Number.isInteger(authDate) || authDate <= 0) {
    throw new TelegramAuthError('Missing or invalid auth_date')
  }
  const nowSeconds = Date.now() / 1000
  if (authDate - nowSeconds > CLOCK_SKEW_SECONDS) {
    throw new TelegramAuthError('auth_date is in the future')
  }
  if (nowSeconds - authDate > maxAgeSeconds) {
    throw new TelegramAuthError('Login widget data is expired')
  }

  const user = WidgetUser.safeParse(fields)
  if (!user.success) throw new TelegramAuthError('Invalid user in login widget payload')
  return {
    user: {
      id: BigInt(user.data.id),
      first_name: user.data.first_name,
      last_name: user.data.last_name,
      username: user.data.username,
      photo_url: user.data.photo_url,
    },
    auth_date: authDate,
  }
}
