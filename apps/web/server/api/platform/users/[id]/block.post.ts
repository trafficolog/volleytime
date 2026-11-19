import { platformUsersService } from '@volley-time/core'

/**
 * Блокировка пользователя root-администратором (22.1.4): флаг, закрытие всех сессий и запись
 * журнала с автором root — одна транзакция. Себя и другого root заблокировать нельзя.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformUsersService.block({ userId: user.id }, pathId(getRouterParam(event, 'id')))
})
