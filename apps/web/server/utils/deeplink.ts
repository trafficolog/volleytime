import {
  buildBotStartAppDeeplink,
  buildInviteDeeplink,
  buildStartParam,
  DeeplinkConfigError,
} from '@volley-time/shared'

/**
 * Личная ссылка передачи владения (21.2.17): Mini App (`startapp=transfer_<token>`) и браузер
 * (`/app/transfer#<token>` — токен во фрагменте, на сервер с адресом не уходит). Без имени бота
 * ссылки Mini App нет (null), веб-ссылка есть всегда.
 */
export function transferLinks(token: string): { telegram: string | null; web: string } {
  const { telegramBotUsername, webUrl } = getServerConfig()
  let telegram: string | null = null
  try {
    telegram = buildBotStartAppDeeplink(telegramBotUsername, buildStartParam('transfer', token))
  } catch (e) {
    if (!(e instanceof DeeplinkConfigError)) throw e
  }
  return { telegram, web: `${webUrl}/app/transfer#${token}` }
}

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
