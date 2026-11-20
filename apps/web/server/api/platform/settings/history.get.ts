import { platformSettingsService } from '@volley-time/core'

/** Последние изменения настроек из журнала (22.3.1): кто, когда, ключ, было → стало. Только root. */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return { entries: await platformSettingsService.history({ userId: user.id }, 10) }
})
