import { platformEventBalancePackagesService } from '@volley-time/core'
import { z } from 'zod'

const Query = z.object({ archived: z.enum(['true', 'false']).optional() })

/**
 * Каталог пакетов баланса событий для Root Admin (22.2.1, ADR-22-2-1): пакеты с ценой за событие,
 * продажами и выручкой по валютам и строка «Без пакета». Только `users.is_root_admin`
 * (401 без сессии, 403 `forbidden.root_only` иначе). `?archived=true` — архивные пакеты.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const query = Query.parse(getQuery(event))
  return platformEventBalancePackagesService.list(
    { userId: user.id },
    { archived: query.archived === 'true' },
  )
})
