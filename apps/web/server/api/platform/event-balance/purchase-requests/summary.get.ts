import { platformPurchaseRequestsService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * Итоги платежей организаций за период `from`/`to` (по дате решения): сумма подтверждённых,
 * ожидающие, доходы по организациям и сверка с журналом баланса (22.2.3). Только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.balance)
  setResponseHeader(event, 'cache-control', 'no-store')
  return forPlatformRole(
    user,
    await platformPurchaseRequestsService.summary({ userId: user.id }, getQuery(event)),
  )
})
