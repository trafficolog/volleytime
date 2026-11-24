import { platformStaffService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Моя роль в команде платформы',
    description:
      '29.3.1 (R-15): роль вошедшего и политики, которые она проходит, — для меню Root Admin по ' +
      'роли. Любой член команды.',
    responses: {
      200: { description: 'PlatformStaffMe' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не член команды (forbidden.root_only)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.self)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformStaffService.me({ userId: user.id })
})
