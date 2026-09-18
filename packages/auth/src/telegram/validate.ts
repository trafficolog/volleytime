import { createHmac, timingSafeEqual } from 'node:crypto'

import { z } from 'zod'

export interface ValidatedInitData {
  user: {
    id: bigint
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    photo_url?: string
  }
  auth_date: number
  chat_instance?: string
  start_param?: string
}

/** Окно действия initData по умолчанию: 1 час (Task 3.9.10). */
export const INIT_DATA_MAX_AGE_SECONDS = 60 * 60
/** Допустимый рассинхрон часов для auth_date «из будущего». */
export const CLOCK_SKEW_SECONDS = 60

const TelegramUserSchema = z
  .object({
    id: z.number().int().positive(),
    first_name: z.string().min(1),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
    photo_url: z.string().url().optional(),
  })
  .passthrough()

export class TelegramAuthError extends Error {
  override name = 'TelegramAuthError'
}

/**
 * Валидирует Telegram WebApp initData по официальному алгоритму.
 * secret_key = HMAC-SHA256(key="WebAppData", msg=bot_token)
 * hash = HMAC-SHA256(key=secret_key, msg=data_check_string)
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(
  initDataRaw: string,
  botToken: string,
  options: { maxAgeSeconds?: number } = {},
): ValidatedInitData {
  // Пустой токен = подпись, которую может посчитать кто угодно (review 3 P0#1)
  if (!botToken || botToken.trim() === '') {
    throw new TelegramAuthError('Bot token is not configured')
  }
  const maxAgeSeconds = options.maxAgeSeconds ?? INIT_DATA_MAX_AGE_SECONDS

  const params = new URLSearchParams(initDataRaw)
  const hash = params.get('hash')
  if (!hash) throw new TelegramAuthError('Missing hash in initData')

  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  // timing-safe сравнение (защита от timing attacks)
  const a = Buffer.from(computedHash, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new TelegramAuthError('Invalid initData signature')
  }

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Number.isNaN(authDate)) {
    throw new TelegramAuthError('Missing or invalid auth_date')
  }
  const nowSeconds = Date.now() / 1000
  if (authDate - nowSeconds > CLOCK_SKEW_SECONDS) {
    throw new TelegramAuthError('auth_date is in the future')
  }
  if (nowSeconds - authDate > maxAgeSeconds) {
    throw new TelegramAuthError('initData is expired')
  }

  const userRaw = params.get('user')
  if (!userRaw) throw new TelegramAuthError('Missing user in initData')

  let userJson: unknown
  try {
    userJson = JSON.parse(userRaw)
  } catch {
    throw new TelegramAuthError('Invalid user in initData')
  }
  const parsedUser = TelegramUserSchema.safeParse(userJson)
  if (!parsedUser.success) throw new TelegramAuthError('Invalid user in initData')
  const userParsed = parsedUser.data

  return {
    user: { ...userParsed, id: BigInt(userParsed.id) },
    auth_date: authDate,
    chat_instance: params.get('chat_instance') ?? undefined,
    start_param: params.get('start_param') ?? undefined,
  }
}
