import { platformUsersService } from '@volley-time/core'
import { PLATFORM_USER_STATUS_FILTERS } from '@volley-time/shared'
import { z } from 'zod'

const Query = z.object({
  status: z.enum(PLATFORM_USER_STATUS_FILTERS).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

/**
 * Пользователи платформы Root Admin (22.1.4): список с поиском и фильтром, только
 * `users.is_root_admin` (401 без сессии, 403 `forbidden.root_only` иначе). Личные данные
 * (email, Telegram-имя) — только в этом ответе и только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const params = Query.parse(getQuery(event))
  return platformUsersService.list({ userId: user.id }, params)
})
