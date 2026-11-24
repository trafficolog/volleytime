import { platformEventBalancePackagesService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'
import { z } from 'zod'

const Query = z.object({ archived: z.enum(['true', 'false']).optional() })

/**
 * Каталог пакетов баланса событий для Root Admin (22.2.1, ADR-22-2-1): пакеты с ценой за событие,
 * продажами и выручкой по валютам и строка «Без пакета». Доступ — роль команды платформы по `PLATFORM_POLICIES` (`platform_staff`, 29.3.1). `?archived=true` — архивные пакеты.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.plans)
  setResponseHeader(event, 'cache-control', 'no-store')
  const query = Query.parse(getQuery(event))
  return forPlatformRole(
    user,
    await platformEventBalancePackagesService.list(
      { userId: user.id },
      { archived: query.archived === 'true' },
    ),
  )
})
