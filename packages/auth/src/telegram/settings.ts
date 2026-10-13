import { INIT_DATA_MAX_AGE_SECONDS } from './validate'

/**
 * Настройки Telegram-входа из окружения (Task 19.3.1). Значения не секретные.
 *
 * - `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` — срок жизни initData Mini App (по умолчанию 3600, 3.9.10).
 * - `TELEGRAM_LOGIN_WIDGET_ENABLED` — вход в веб через Telegram Login Widget (D-05); по умолчанию
 *   выключен, production не меняется, пока владелец не включит флаг.
 * - `TELEGRAM_LOGIN_WIDGET_MAX_AGE_SECONDS` — срок жизни данных виджета (по умолчанию 3600).
 *
 * Неверное значение — ошибка конфигурации (fail closed), а не тихий откат к дефолту.
 */
export interface TelegramAuthSettings {
  initDataMaxAgeSeconds: number
  loginWidget: { enabled: boolean; maxAgeSeconds: number }
}

export const LOGIN_WIDGET_MAX_AGE_SECONDS = 60 * 60
/** Нижняя граница — запас на рассинхрон часов, верхняя — сутки: дольше подпись не живёт. */
export const MIN_AUTH_MAX_AGE_SECONDS = 60
export const MAX_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60

export class TelegramConfigError extends Error {
  override name = 'TelegramConfigError'
}

type Env = Record<string, string | undefined>

function parseMaxAge(env: Env, key: string, fallback: number): number {
  const raw = env[key]?.trim()
  if (!raw) return fallback
  if (!/^\d+$/.test(raw)) throw new TelegramConfigError(`${key} must be an integer of seconds`)
  const value = Number(raw)
  if (value < MIN_AUTH_MAX_AGE_SECONDS || value > MAX_AUTH_MAX_AGE_SECONDS) {
    throw new TelegramConfigError(
      `${key} must be between ${MIN_AUTH_MAX_AGE_SECONDS} and ${MAX_AUTH_MAX_AGE_SECONDS}`,
    )
  }
  return value
}

function parseFlag(env: Env, key: string): boolean {
  const raw = env[key]?.trim().toLowerCase()
  if (!raw || raw === 'false' || raw === '0') return false
  if (raw === 'true' || raw === '1') return true
  throw new TelegramConfigError(`${key} must be true or false`)
}

export function telegramAuthSettingsFromEnv(env: Env = process.env): TelegramAuthSettings {
  return {
    initDataMaxAgeSeconds: parseMaxAge(
      env,
      'TELEGRAM_INIT_DATA_MAX_AGE_SECONDS',
      INIT_DATA_MAX_AGE_SECONDS,
    ),
    loginWidget: {
      enabled: parseFlag(env, 'TELEGRAM_LOGIN_WIDGET_ENABLED'),
      maxAgeSeconds: parseMaxAge(
        env,
        'TELEGRAM_LOGIN_WIDGET_MAX_AGE_SECONDS',
        LOGIN_WIDGET_MAX_AGE_SECONDS,
      ),
    },
  }
}
