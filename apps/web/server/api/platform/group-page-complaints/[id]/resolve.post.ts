import { groupPageModerationService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Решение по странице из жалобы',
    description:
      '24.1.3 (R-06): «Скрыть» или «Noindex» из жалобы — то же решение, что POST ' +
      '/api/platform/group-pages/{id}/moderation, и жалоба закрывается им (status resolved, ' +
      'resolution = state). Если такое решение уже действует, жалоба закрывается без нового ' +
      'решения и уведомления. Только Root Admin.',
    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['state', 'reasonCode'],
            additionalProperties: false,
            properties: {
              state: { type: 'string', enum: ['hidden', 'noindex'] },
              reasonCode: {
                type: 'string',
                enum: ['price', 'pay', 'promise', 'media', 'inactive', 'spam'],
              },
              note: { type: 'string', nullable: true, description: 'до 1000 символов' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: '{ id, page: PlatformGroupPageRow }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не root (forbidden.root_only)' },
      404: { description: 'Жалоба не найдена (group_page.complaint_not_found)' },
      409: {
        description:
          'Жалоба уже закрыта (group_page.complaint_closed) или noindex поверх noindex владельца ' +
          '(group_page.owner_noindex)',
      },
      422: { description: 'Нет причины или неверное поле (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.groupPageComplaintsResolve)
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = pathId(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => null)
  return withNotifications((notifications) =>
    groupPageModerationService.resolveComplaint({ userId: user.id, notifications }, id, body ?? {}),
  )
})
