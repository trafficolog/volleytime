import { platformEventBalancePackagesService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * Правка пакета (22.2.1): цена, бейдж, видимость, порядок. `version` из списка обязателен
 * (409 `event_balance_package.stale` при чужой правке); `units`, `currency`, `code` в теле — 422.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.plansManage)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformEventBalancePackagesService.update(
    { userId: user.id },
    pathId(getRouterParam(event, 'id')),
    await readBody(event),
  )
})
