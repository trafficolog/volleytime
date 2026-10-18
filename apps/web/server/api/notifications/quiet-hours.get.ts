import { notificationFeedService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['notifications'],
    summary: 'Тихие часы пользователя',
    description:
      'Окно в минутах от полуночи часового пояса группы-источника; `quietHours: null` — не заданы.',
    responses: {
      200: { description: '{ quietHours: { start, end } | null }' },
      401: { description: 'Нет сессии' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  return { quietHours: await notificationFeedService.getQuietHours(user.id) }
})
