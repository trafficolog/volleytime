import { platformOrganizationsService } from '@volley-time/core'

/** Карточка организации платформы (22.1.3): профиль, показатели, журнал группы и баланс. */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformOrganizationsService.get({ userId: user.id }, pathId(getRouterParam(event, 'id')))
})
