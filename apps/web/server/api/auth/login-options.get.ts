import { loginOptionsFromEnv } from '../../utils/login-options'

/**
 * Публичные параметры экрана входа: показывать ли кнопку Telegram Login Widget (D-05, 20.5.1).
 * Флаг TELEGRAM_LOGIN_WIDGET_ENABLED читается на каждый запрос; секреты не отдаются.
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const config = useRuntimeConfig(event)
  return loginOptionsFromEnv(
    process.env,
    config.public.telegramBotUsername || process.env.TELEGRAM_BOT_USERNAME,
  )
})
