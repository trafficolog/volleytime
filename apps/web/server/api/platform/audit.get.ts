import { platformAuditService } from '@volley-time/core'
import {
  PLATFORM_AUDIT_CATEGORIES,
  PLATFORM_AUDIT_PERIODS,
  PLATFORM_POLICIES,
} from '@volley-time/shared'
import { z } from 'zod'

const Query = z.object({
  period: z.enum(PLATFORM_AUDIT_PERIODS).optional(),
  organizationId: z.coerce.number().int().positive().optional(),
  category: z.enum(PLATFORM_AUDIT_CATEGORIES).optional(),
  q: z.string().max(100).optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

/**
 * Журнал действий платформы Root Admin (22.1.2): только чтение, только `users.is_root_admin`
 * (401 без сессии, 403 `forbidden.root_only` иначе). Изменяющих маршрутов у журнала нет.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.audit)
  setResponseHeader(event, 'cache-control', 'no-store')
  const params = Query.parse(getQuery(event))
  return platformAuditService.list({ userId: user.id }, params)
})
