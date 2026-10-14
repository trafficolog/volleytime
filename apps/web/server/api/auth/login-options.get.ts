import { loginOptionsFromEnv } from '../../utils/login-options'

/**
 * Публичные параметры экрана входа: показывать ли кнопку Telegram и с каким bot_id (D-05, 20.5.1).
 * Флаг TELEGRAM_LOGIN_WIDGET_ENABLED читается на каждый запрос; секреты не отдаются.
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  return loginOptionsFromEnv(process.env)
})
