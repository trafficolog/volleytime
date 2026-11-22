import { playerFeaturesService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['me'],
    summary: 'Изменить личные функции игрока',
    description:
      '23.1.1 (P-12): частичное обновление флагов. Данные выключенной функции не удаляются. ' +
      'Выключенные `cal`, `teams` и `mvp` отключают напоминания, составы и голосование MVP в боте ' +
      '(D-23); критичные уведомления и лента Mini App не меняются. Неизвестные ключи, в том числе ' +
      'расписание, запись и оплата, отклоняются.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              cal: { type: 'boolean' },
              coach: { type: 'boolean' },
              warmup: { type: 'boolean' },
              self: { type: 'boolean' },
              mvp: { type: 'boolean' },
              teams: { type: 'boolean' },
              streak: { type: 'boolean' },
              wrapped: { type: 'boolean' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Обновлённые флаги: { features } (как в GET)' },
      401: { description: 'Нет сессии' },
      422: { description: 'Неизвестный ключ или не boolean (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  return {
    features: await playerFeaturesService.update({ userId: user.id }, body ?? {}),
  }
})
