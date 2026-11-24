import { platformUsersService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/** Разблокировка пользователя root-администратором (22.1.4): флаг и запись журнала. */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.usersManage)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformUsersService.unblock({ userId: user.id }, pathId(getRouterParam(event, 'id')))
})
