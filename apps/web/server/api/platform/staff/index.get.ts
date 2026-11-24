import { platformStaffService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Команда платформы',
    description:
      '29.3.1 (R-15): члены команды платформы с ролью, кем приглашены и когда. Только Owner.',
    responses: {
      200: { description: 'PlatformStaffList' },
      401: { description: 'Нет сессии' },
      403: {
        description: 'Не член команды (forbidden.root_only) или не Owner (forbidden.platform_role)',
      },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.team)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformStaffService.list({ userId: user.id })
})
