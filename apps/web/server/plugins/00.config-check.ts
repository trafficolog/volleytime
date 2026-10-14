import { TelegramConfigError, telegramAuthSettingsFromEnv } from '@volley-time/auth'

import { resolveServerConfig } from '../utils/config'

/**
 * Fail-fast конфигурации (Task 3.9.2): в production процесс не стартует без обязательных
 * переменных. В dev — предупреждение. Значения секретов не логируются.
 * Настройки Telegram-входа (срок жизни initData, флаг Login Widget, 19.3.1) проверяются так же:
 * неверное значение в production останавливает старт, в сообщении только имя переменной.
 */
export default defineNitroPlugin(() => {
  const { missing, isProduction } = resolveServerConfig(useRuntimeConfig() as never)
  if (missing.length > 0) {
    const message = `[config] missing required env: ${missing.join(', ')}`
    if (isProduction) {
      console.error(message)
      throw new Error(message)
    }
    console.warn(`${message} (dev: using defaults where possible)`)
  }
  try {
    telegramAuthSettingsFromEnv()
  } catch (e) {
    if (!(e instanceof TelegramConfigError)) throw e
    const message = `[config] invalid Telegram auth settings: ${e.message}`
    if (isProduction) {
      console.error(message)
      throw new Error(message)
    }
    console.warn(message)
  }
})
