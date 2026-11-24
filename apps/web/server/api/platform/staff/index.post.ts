import { platformStaffService } from '@volley-time/core'
import { PLATFORM_POLICIES, PLATFORM_ROLES } from '@volley-time/shared'

defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Пригласить в команду платформы',
    description:
      '29.3.1 (R-15): существующий активный пользователь (email или Telegram-имя) получает одну ' +
      'роль. Пишется audit_log platform.staff.invited. Только Owner.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['user', 'role'],
            additionalProperties: false,
            properties: {
              user: { type: 'string', description: 'email или Telegram-имя' },
              role: { type: 'string', enum: [...PLATFORM_ROLES] },
            },
          },
        },
      },
    },
    responses: {
      201: { description: 'PlatformStaffMember' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не Owner (forbidden.root_only, forbidden.platform_role)' },
      404: { description: 'Пользователь не найден (platform.staff_user_not_found)' },
      409: {
        description:
          'Уже в команде (platform.staff_exists), несколько совпадений ' +
          '(platform.staff_user_ambiguous) или заблокирован (platform.staff_user_inactive)',
      },
      422: { description: 'Неверное тело (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.team)
  setResponseHeader(event, 'cache-control', 'no-store')
  const body = await readBody(event).catch(() => null)
  const member = await platformStaffService.invite({ userId: user.id }, body ?? {})
  setResponseStatus(event, 201)
  return member
})
