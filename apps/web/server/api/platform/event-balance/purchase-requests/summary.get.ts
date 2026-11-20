import { platformPurchaseRequestsService } from '@volley-time/core'

/**
 * Итоги платежей организаций за период `from`/`to` (по дате решения): сумма подтверждённых,
 * ожидающие, доходы по организациям и сверка с журналом баланса (22.2.3). Только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformPurchaseRequestsService.summary({ userId: user.id }, getQuery(event))
})
