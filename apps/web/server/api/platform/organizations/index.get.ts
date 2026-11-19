import { platformOrganizationsService } from '@volley-time/core'
import { PLATFORM_ORG_SORTS, PLATFORM_ORG_STATUS_FILTERS } from '@volley-time/shared'
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
 * Организации платформы Root Admin (22.1.3): список с фильтрами, только `users.is_root_admin`
 * (401 без сессии, 403 `forbidden.root_only` иначе).
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const params = Query.parse(getQuery(event))
  return platformOrganizationsService.list({ userId: user.id }, params)
})
