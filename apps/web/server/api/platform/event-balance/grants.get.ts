import { platformEventBalanceGrantsService } from '@volley-time/core'

/**
 * Ручные начисления баланса событий (22.2.2): записи журнала `grant` всех организаций, новые сверху,
 * keyset-пагинация `?cursor=<id последней записи>&limit=`. Только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformEventBalanceGrantsService.list({ userId: user.id }, getQuery(event))
})
