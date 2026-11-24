import { platformOrganizationsService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * Ручное создание организации root-администратором (22.1.3). Группа, членство владельца, демо-квота
 * и запись журнала с автором root пишутся в одной транзакции.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.organizationsManage)
  setResponseHeader(event, 'cache-control', 'no-store')
  const body = await readBody(event)
  const created = await platformOrganizationsService.create({ userId: user.id }, body)
  setResponseStatus(event, 201)
  return created
})
