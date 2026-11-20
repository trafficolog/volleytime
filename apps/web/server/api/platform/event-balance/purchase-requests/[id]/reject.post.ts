import { platformPurchaseRequestsService } from '@volley-time/core'

/**
 * Отклонить заявку (22.2.3): обязательная причина `{ reason }`, баланс не меняется, аудит в той же
 * транзакции. Уже решённая заявка — 409 `purchase_request.not_pending`. Только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const requestId = pathId(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => null)
  const fields = body !== null && typeof body === 'object' && !Array.isArray(body) ? body : {}
  return platformPurchaseRequestsService.reject(
    { userId: user.id },
    { ...(fields as { reason: string }), requestId },
  )
})
