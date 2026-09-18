import { buildInviteDeeplink, DeeplinkConfigError } from '@volley-time/shared'

/** Deeplink приглашения с именем бота из конфигурации; пустое имя → 500 misconfigured. */
export function inviteDeeplink(token: string): string {
  try {
    return buildInviteDeeplink(getServerConfig().telegramBotUsername, token)
  } catch (e) {
    if (e instanceof DeeplinkConfigError) {
      console.error('[config] TELEGRAM_BOT_USERNAME is not configured')
      throw createError({
        statusCode: 500,
        statusMessage: 'Telegram bot is not configured',
        data: { code: e.code },
      })
    }
    throw e
  }
}
