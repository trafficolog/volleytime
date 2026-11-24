import { platformStaffService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Убрать из команды платформы',
    description:
      '29.3.1 (R-15): доступ к Root Admin пропадает со следующего запроса. Последнего Owner ' +
      'удалить нельзя, в том числе самому себе. Пишется audit_log platform.staff.removed. ' +
      'Только Owner.',
    parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: 'userId удалённого' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не Owner (forbidden.root_only, forbidden.platform_role)' },
      404: { description: 'Не в команде (platform.staff_not_found)' },
      409: { description: 'Последний Owner (platform.staff_last_owner)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.team)
  setResponseHeader(event, 'cache-control', 'no-store')
  return platformStaffService.remove({ userId: user.id }, pathId(getRouterParam(event, 'userId')))
})
