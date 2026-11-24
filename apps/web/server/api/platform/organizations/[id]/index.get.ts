import { platformOrganizationsService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/** Карточка организации платформы (22.1.3): профиль, показатели, журнал группы и баланс. */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.organizations)
  setResponseHeader(event, 'cache-control', 'no-store')
  return forPlatformRole(
    user,
    await platformOrganizationsService.get(
      { userId: user.id },
      pathId(getRouterParam(event, 'id')),
    ),
  )
})
