import { notificationFeedService, quietHoursSchema } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['notifications'],
    summary: 'Задать тихие часы',
    description:
      'Тело `{ start, end }` в минутах от полуночи (0–1439) или `null` — выключить. Некритичные ' +
      'уведомления в окне откладываются до его конца; место из очереди, оплата и отмена события ' +
      'приходят всегда.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            nullable: true,
            type: 'object',
            required: ['start', 'end'],
            properties: {
              start: { type: 'integer', minimum: 0, maximum: 1439 },
              end: { type: 'integer', minimum: 0, maximum: 1439 },
            },
          },
        },
      },
    },
    responses: {
      200: { description: '{ quietHours }' },
      401: { description: 'Нет сессии' },
      422: { description: 'Значение вне диапазона (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const body = quietHoursSchema.parse(await readBody(event))
  return { quietHours: await notificationFeedService.setQuietHours(user.id, body) }
})
