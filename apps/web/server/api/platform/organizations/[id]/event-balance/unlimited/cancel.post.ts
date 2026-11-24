import { PlatformUnlimitedError, platformEventBalanceUnlimitedService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * Отключить безлимит событий группы (22.3.1): `{ reason }` (3–500 символов). POST, а не `DELETE` с
 * телом: тело `DELETE` не гарантируется прокси и клиентами. Без активного безлимита — 200 без аудита.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.balanceManage)
  setResponseHeader(event, 'cache-control', 'no-store')
  const orgId = pathId(getRouterParam(event, 'id'))
  try {
    return await platformEventBalanceUnlimitedService.cancel(
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
