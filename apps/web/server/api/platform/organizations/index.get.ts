import { platformOrganizationsService } from '@volley-time/core'
import {
  PLATFORM_ORG_SORTS,
  PLATFORM_ORG_STATUS_FILTERS,
  PLATFORM_POLICIES,
} from '@volley-time/shared'
import { z } from 'zod'

/** `1`/`true` из строки запроса; прочее — ошибка валидации (`z.coerce.boolean` считал бы «false» истиной). */
const Flag = z.enum(['0', '1', 'true', 'false']).transform((v) => v === '1' || v === 'true')

const Query = z.object({
  status: z.enum(PLATFORM_ORG_STATUS_FILTERS).optional(),
  lowBalance: Flag.optional(),
  inactive: Flag.optional(),
  sort: z.enum(PLATFORM_ORG_SORTS).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

/**
 * Организации платформы Root Admin (22.1.3): список с фильтрами, доступ —
 * роль команды платформы по `PLATFORM_POLICIES` (`platform_staff`, 29.3.1). Analyst не ищет по email и Telegram владельца.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.organizations)
  setResponseHeader(event, 'cache-control', 'no-store')
  const params = Query.parse(getQuery(event))
  return forPlatformRole(user, await platformOrganizationsService.list({ userId: user.id }, params))
})
