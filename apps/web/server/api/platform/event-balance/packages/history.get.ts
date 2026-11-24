import { platformEventBalancePackagesService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * История изменений каталога пакетов (22.2.1): записи журнала платформы по пакетам, новые сверху,
 * keyset-пагинация `?cursor=<id последней записи>&limit=`. Только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.plans)
  setResponseHeader(event, 'cache-control', 'no-store')
  return forPlatformRole(
    user,
    await platformEventBalancePackagesService.history({ userId: user.id }, getQuery(event)),
  )
})
