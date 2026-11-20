import { platformPurchaseRequestsService } from '@volley-time/core'

/**
 * Реестр заявок организаций на покупку баланса событий (22.2.3, D-07): фильтры `status`,
 * `organizationId`, период `from`/`to` (ISO, по дате заявки), keyset `cursor` + `limit`. Только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformPurchaseRequestsService.list({ userId: user.id }, getQuery(event))
})
