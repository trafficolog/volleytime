import { platformOverviewService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * Обзор платформы Root Admin (22.1.1): главная метрика, недельные счётчики, метрики гипотез
 * Phase 10. Только `users.is_root_admin` (401 без сессии, 403 `forbidden.root_only` иначе).
 * Вне tenant-префикса: `event.context.userId` не заполнен, пользователь — из `requireRootAdmin`.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.overview)
  setResponseHeader(event, 'cache-control', 'no-store')
  return forPlatformRole(user, await platformOverviewService.getOverview({ userId: user.id }))
})
