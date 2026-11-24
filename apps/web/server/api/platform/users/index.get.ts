import { platformUsersService } from '@volley-time/core'
import { PLATFORM_USER_STATUS_FILTERS, PLATFORM_POLICIES } from '@volley-time/shared'
import { z } from 'zod'

const Query = z.object({
  status: z.enum(PLATFORM_USER_STATUS_FILTERS).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

/**
 * Пользователи платформы Root Admin (22.1.4): список с поиском и фильтром, доступ —
 * роль команды платформы по `PLATFORM_POLICIES` (`platform_staff`, 29.3.1). Личные данные
 * (email, Telegram-имя) — только ролям с политикой `users`.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.users)
  setResponseHeader(event, 'cache-control', 'no-store')
  const params = Query.parse(getQuery(event))
  return platformUsersService.list({ userId: user.id }, params)
})
