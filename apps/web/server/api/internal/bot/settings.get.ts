import { platformSettingsService } from '@volley-time/core'

/**
 * Настройки платформы для бота (22.3.1, ADR-22-3-1): только ключи `bot.*`. Внутренний секрет
 * (сравнение за постоянное время, как у остальных `/api/internal/bot/*`); значения из кэша web (30 с).
 */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformSettingsService.botSettings()
})
