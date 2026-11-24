import { platformOverviewService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * Обзор платформы Root Admin (22.1.1): главная метрика, недельные счётчики, метрики гипотез
 * Phase 10. Доступ — роль команды платформы по `PLATFORM_POLICIES` (`platform_staff`, 29.3.1).
 * Вне tenant-префикса: `event.context.userId` не заполнен, пользователь — из `requirePlatformRole`.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.overview)
  setResponseHeader(event, 'cache-control', 'no-store')
  return forPlatformRole(user, await platformOverviewService.getOverview({ userId: user.id }))
})
