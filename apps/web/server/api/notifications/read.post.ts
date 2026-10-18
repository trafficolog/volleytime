import { markReadSchema, notificationFeedService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['notifications'],
    summary: 'Отметить уведомления прочитанными',
    description:
      'Перечисленные `ids` или все (`all: true`, по желанию в одной группе). ' +
      'Чужие идентификаторы не затрагиваются. Повтор — no-op.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              ids: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 200 },
              all: { type: 'boolean', enum: [true] },
              organizationId: { type: 'integer' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: '{ updated }' },
      401: { description: 'Нет сессии' },
      422: { description: 'Нужны ids или all (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const body = markReadSchema.parse((await readBody(event)) ?? {})
  const updated = await notificationFeedService.markRead(user.id, body)
  return { updated }
})
