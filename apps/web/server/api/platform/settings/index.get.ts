import { platformSettingsService } from '@volley-time/core'

/**
 * Настройки платформы (22.3.1, ADR-22-3-1, R-05): значения, версии и статусы только для чтения
 * (платежи, безопасность, интеграции, feature flags — булевы статусы, без ключей и секретов).
 * Только `users.is_root_admin` (401 без сессии, 403 `forbidden.root_only` иначе).
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformSettingsService.get({ userId: user.id })
})
