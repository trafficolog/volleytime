import { PlatformUnlimitedError, platformEventBalanceUnlimitedService } from '@volley-time/core'

/**
 * Безлимит событий группы до даты (22.3.1, ADR-22-3-1): `{ until: 'YYYY-MM-DD', reason }`, дата —
 * последний день по Минску включительно, не раньше сегодня и не позже сегодня + 366 дней. Включает
 * или меняет дату; повтор той же даты — 200 без новой записи аудита. Нет группы — 404, удалённая
 * группа — 409 `organization.deleted`. Только root.
 */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const orgId = pathId(getRouterParam(event, 'id'))
  try {
    return await platformEventBalanceUnlimitedService.set(
      { userId: user.id },
      orgId,
      await readBody(event),
    )
  } catch (e) {
    if (e instanceof PlatformUnlimitedError) {
      throw createError({ statusCode: 409, statusMessage: e.message, data: { code: e.code } })
    }
    throw e
  }
})
