import { platformStaffService } from '@volley-time/core'
import { PLATFORM_POLICIES, PLATFORM_ROLES } from '@volley-time/shared'

defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Изменить роль члена команды платформы',
    description:
      '29.3.1 (R-15): одна роль на человека; действует со следующего запроса. Последнего Owner ' +
      'нельзя понизить, в том числе самому себе. Пишется audit_log platform.staff.role_changed ' +
      '(было и стало). Только Owner.',
    parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['role'],
            additionalProperties: false,
            properties: { role: { type: 'string', enum: [...PLATFORM_ROLES] } },
          },
        },
      },
    },
    responses: {
      200: { description: 'PlatformStaffMember' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не Owner (forbidden.root_only, forbidden.platform_role)' },
      404: { description: 'Не в команде (platform.staff_not_found)' },
      409: {
        description:
          'Та же роль (platform.staff_same_role) или последний Owner (platform.staff_last_owner)',
      },
      422: { description: 'Неверное тело (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.team)
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = pathId(getRouterParam(event, 'userId'))
  const body = await readBody(event).catch(() => null)
  return platformStaffService.changeRole({ userId: user.id }, id, body ?? {})
})
