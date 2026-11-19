import { platformEventBalancePackagesService } from '@volley-time/core'

/**
 * Новый пакет баланса событий (22.2.1): черновик со сгенерированным сервером кодом `events_<N>`.
 * Количество событий и валюта после создания не меняются. Запись журнала — в той же транзакции.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const created = await platformEventBalancePackagesService.create(
    { userId: user.id },
    await readBody(event),
  )
  setResponseStatus(event, 201)
  return created
})
