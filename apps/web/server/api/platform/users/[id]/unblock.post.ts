import { platformUsersService } from '@volley-time/core'

/** Разблокировка пользователя root-администратором (22.1.4): флаг и запись журнала. */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformUsersService.unblock({ userId: user.id }, pathId(getRouterParam(event, 'id')))
})
