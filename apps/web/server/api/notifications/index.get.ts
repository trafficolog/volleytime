import { feedQuerySchema, notificationFeedService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['notifications'],
    summary: 'Лента уведомлений пользователя',
    description:
      'Хранимая лента (P-09): уведомления пользователя по всем его группам, новые сверху. ' +
      '`organizationId` сужает выбор одной группой. Доступны только собственные уведомления.',
    parameters: [
      { in: 'query', name: 'organizationId', schema: { type: 'integer' } },
      { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
    ],
    responses: {
      200: { description: '{ items, nextCursor, unreadCount }' },
      401: { description: 'Нет сессии' },
      422: { description: 'Неверные параметры (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const query = feedQuerySchema.parse(getQuery(event))
  return notificationFeedService.list(user.id, query)
})
