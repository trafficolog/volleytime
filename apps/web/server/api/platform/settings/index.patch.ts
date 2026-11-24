import { PlatformSettingsError, platformSettingsService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * Правка настроек платформы (22.3.1): `{ changes: [{ key, value, version }] }`, 1–20 ключей без
 * повторов. Все изменения или ни одного; чужая правка — 409 `platform_settings.stale` с текущим
 * состоянием в теле (`data.current`); значение вне схемы — 422 с путём ключа; неизвестный ключ —
 * 422 `platform_settings.unknown_key`. Значение, равное действующему, ничего не пишет (no-op).
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.settings)
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    return await platformSettingsService.update({ userId: user.id }, await readBody(event))
  } catch (e) {
    if (e instanceof PlatformSettingsError && e.code === 'platform_settings.stale') {
      throw createError({
        statusCode: 409,
        statusMessage: e.message,
        data: { code: e.code, current: e.current },
      })
    }
    throw e
  }
})
