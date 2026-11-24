import { platformEventBalanceGrantsService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * Ручные начисления баланса событий (22.2.2): записи журнала `grant` всех организаций, новые сверху,
 * keyset-пагинация `?cursor=<id последней записи>&limit=`. Только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.balance)
  setResponseHeader(event, 'cache-control', 'no-store')
  return forPlatformRole(
    user,
    await platformEventBalanceGrantsService.list({ userId: user.id }, getQuery(event)),
  )
})
