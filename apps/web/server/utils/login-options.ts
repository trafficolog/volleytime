import { loginWidgetEnabledFromEnv } from '@volley-time/auth'

/** Публичные параметры экрана входа (D-05). Без секретов: только флаг и username бота. */
export interface LoginOptions {
  telegramWidget: { botUsername: string } | null
}

const BOT_USERNAME = /^[A-Za-z0-9_]{5,32}$/

export function loginOptionsFromEnv(
  env: Record<string, string | undefined>,
  botUsername: string | undefined,
): LoginOptions {
  const username = botUsername?.trim().replace(/^@/, '') ?? ''
  if (!loginWidgetEnabledFromEnv(env) || !BOT_USERNAME.test(username)) {
    return { telegramWidget: null }
  }
  return { telegramWidget: { botUsername: username } }
}
