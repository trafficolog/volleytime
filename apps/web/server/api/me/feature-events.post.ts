import { featureAnalyticsService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['me'],
    summary: 'Записать событие функции игрока',
    description:
      '23.1.2 (P-14, D-25): открытие (`open`) или использование (`use`) одной из восьми личных ' +
      'функций. Игрок — из сессии. Одно событие вида на игрока, функцию и сутки UTC: повтор ' +
      'не пишется (`recorded: false`). События хранятся 180 дней и попадают в отчёт Root Admin только ' +
      'агрегатами по платформе.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['feature', 'kind'],
            additionalProperties: false,
            properties: {
              feature: {
                type: 'string',
                enum: ['cal', 'coach', 'warmup', 'self', 'mvp', 'teams', 'streak', 'wrapped'],
              },
              kind: { type: 'string', enum: ['open', 'use'] },
            },
          },
        },
      },
    },
    responses: {
      200: { description: '{ recorded: boolean } — false, если событие за эти сутки уже есть' },
      401: { description: 'Нет сессии' },
      422: { description: 'Функция или вид вне списка, лишние ключи (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  return featureAnalyticsService.record({ userId: user.id }, body ?? {})
})
