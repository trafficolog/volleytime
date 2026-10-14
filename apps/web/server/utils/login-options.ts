import { loginWidgetEnabledFromEnv } from '@volley-time/auth'

/**
 * Публичные параметры экрана входа (D-05). Без секретов: только флаг и публичный числовой
 * id бота (часть токена до двоеточия; Telegram.Login.auth требует его в `bot_id`).
 */
export interface LoginOptions {
  telegramWidget: { botId: number } | null
}

/** Числовой префикс токена бота; остальная часть токена никогда не покидает функцию. */
export function botIdFromToken(token: string | undefined): number | null {
  const match = /^(\d{1,15}):/.exec(token?.trim() ?? '')
  if (!match) return null
  const id = Number(match[1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function loginOptionsFromEnv(env: Record<string, string | undefined>): LoginOptions {
  if (!loginWidgetEnabledFromEnv(env)) return { telegramWidget: null }
  // как botTokenFromEnv в auth: NUXT_* перекрывает обычную переменную
  const botId = botIdFromToken(env.NUXT_TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN)
  return botId === null ? { telegramWidget: null } : { telegramWidget: { botId } }
}
