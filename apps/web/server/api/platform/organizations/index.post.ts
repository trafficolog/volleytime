import { platformOrganizationsService } from '@volley-time/core'

/**
 * Ручное создание организации root-администратором (22.1.3). Группа, членство владельца, демо-квота
 * и запись журнала с автором root пишутся в одной транзакции.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const body = await readBody(event)
  const created = await platformOrganizationsService.create({ userId: user.id }, body)
  setResponseStatus(event, 201)
  return created
})
