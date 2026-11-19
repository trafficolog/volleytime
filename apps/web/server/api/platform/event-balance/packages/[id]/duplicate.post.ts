import { platformEventBalancePackagesService } from '@volley-time/core'

/**
 * «Дублировать» пакет (22.2.1): новый черновик с копией бейджа. Тело `{ units?, amount? }`; занятое
 * среди неархивных пакетов количество — 409 `event_balance_package.units_taken`.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const copy = await platformEventBalancePackagesService.duplicate(
    { userId: user.id },
    pathId(getRouterParam(event, 'id')),
    (await readBody(event).catch(() => undefined)) ?? {},
  )
  setResponseStatus(event, 201)
  return copy
})
