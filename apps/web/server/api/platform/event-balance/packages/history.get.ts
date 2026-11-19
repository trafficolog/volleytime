import { platformEventBalancePackagesService } from '@volley-time/core'

/**
 * История изменений каталога пакетов (22.2.1): записи журнала платформы по пакетам, новые сверху,
 * keyset-пагинация `?cursor=<id последней записи>&limit=`. Только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformEventBalancePackagesService.history({ userId: user.id }, getQuery(event))
})
