import { levelService } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['levels'],
    summary: 'Справочник уровней В1–В4+',
    description:
      'Единая шкала уровней игроков, групп и событий по порядку от В1 к В4+. ' +
      'Глобальный справочник без привязки к группе; доступен любому авторизованному пользователю.',
    responses: {
      200: {
        description: 'Уровни по порядку шкалы',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['levels'],
              properties: {
                levels: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['code', 'title', 'description', 'sortOrder'],
                    properties: {
                      code: { type: 'string', enum: ['v1', 'v2', 'v3', 'v4', 'v4_plus'] },
                      title: { type: 'string', example: 'В1' },
                      description: { type: 'string' },
                      sortOrder: { type: 'integer', minimum: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Нет сессии' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const levels = await levelService.list({ userId: user.id })
  return { levels }
})
