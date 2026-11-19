import { platformEventBalancePackagesService } from '@volley-time/core'

/**
 * Архив пакета — «Удалить» (22.2.1): необратимо из интерфейса; заявки пакета не меняются.
 * Повтор на архивном пакете — 200 без новой записи журнала.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformEventBalancePackagesService.archive(
    { userId: user.id },
    pathId(getRouterParam(event, 'id')),
    await readBody(event),
  )
})
