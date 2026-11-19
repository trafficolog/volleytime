import { platformEventBalanceGrantsService } from '@volley-time/core'

/**
 * Ручное начисление баланса событий организации (22.2.2, R-03): количество, категория, обязательная
 * причина и ключ идемпотентности `idempotencyKey` (UUID). Баланс, журнал и аудит — одна транзакция.
 * 201 — начислено; 200 — повтор той же отправки (тот же ключ), баланс не менялся. Только root.
 * Организация — из пути (`pathId`: некорректный id — 404); `organizationId` в теле игнорируется.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const organizationId = pathId(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const fields = body !== null && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const result = await platformEventBalanceGrantsService.grant(
    { userId: user.id },
    { ...fields, organizationId },
  )
  setResponseStatus(event, result.replayed ? 200 : 201)
  return result
})
