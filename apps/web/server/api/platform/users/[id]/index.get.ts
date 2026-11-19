import { platformUsersService } from '@volley-time/core'

/** Карточка пользователя платформы (22.1.4): профиль, группы и роли, журнал блокировок. */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformUsersService.get({ userId: user.id }, pathId(getRouterParam(event, 'id')))
})
