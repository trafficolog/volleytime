import { platformPurchaseRequestsService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * Подтвердить заявку (22.2.3): `pending → approved` и начисление на снимок заявки, журнал и аудит —
 * одна транзакция. Повтор или гонка — 409 `purchase_request.not_pending`, второго начисления нет.
 * Тело: `{ comment? }`. Только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.balanceManage)
  setResponseHeader(event, 'cache-control', 'no-store')
  const requestId = pathId(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => null)
  const fields = body !== null && typeof body === 'object' && !Array.isArray(body) ? body : {}
  return platformPurchaseRequestsService.approve({ userId: user.id }, { ...fields, requestId })
})
