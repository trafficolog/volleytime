import { organizationSettingsService, requireCanManageContent } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Настройки группы',
    description:
      'Значения по умолчанию для новых событий и политика отмены. Доступно владельцу и организатору.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: {
        description: 'Настройки группы',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['settings'],
              properties: {
                settings: {
                  type: 'object',
                  properties: {
                    subscriptionsEnabled: { type: 'boolean' },
                    maxSeatsPerBooking: { type: 'integer', minimum: 1, maximum: 10 },
                    defaultPriceMode: { type: 'string', enum: ['fixed', 'split'] },
                    defaultJoinMode: { type: 'string', enum: ['open', 'invite'] },
                    cancellationAllowed: { type: 'boolean' },
                    cancellationDeadlineHours: {
                      type: 'integer',
                      minimum: 0,
                      maximum: 720,
                      nullable: true,
                    },
                    seoIndex: { type: 'boolean' },
                    city: { type: 'string', nullable: true },
                    district: { type: 'string', nullable: true },
                    levels: {
                      type: 'array',
                      items: { type: 'string', enum: ['v1', 'v2', 'v3', 'v4', 'v4_plus'] },
                      description: 'уровни группы в порядке шкалы В1–В4+ (GET /api/levels)',
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или недостаточно прав (forbidden.*)' },
      404: { description: 'Группа не найдена (organization.not_found)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const settings = await organizationSettingsService.get(ctx, event.context.organization!.id)
  return { settings }
})
