import { eventBalanceService, requireCanManageContent } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['event-balance'],
    summary: 'Баланс событий группы',
    description:
      'Остаток баланса событий (1 событие = 1 единица), порог «баланс заканчивается», каталог ' +
      'пакетов и заявки на покупку в ожидании подтверждения. Доступно владельцу и организатору.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: {
        description: '{ eventBalance }',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['eventBalance'],
              properties: {
                eventBalance: {
                  type: 'object',
                  properties: {
                    balance: { type: 'integer', minimum: 0 },
                    lowThreshold: { type: 'integer' },
                    low: { type: 'boolean', description: 'остаток не больше порога' },
                    packages: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          code: { type: 'string', enum: ['events_10', 'events_30', 'events_100'] },
                          units: { type: 'integer' },
                          amount: { type: 'integer', description: 'minor units' },
                          currency: { type: 'string' },
                          popular: { type: 'boolean' },
                        },
                      },
                    },
                    pendingRequests: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          units: { type: 'integer' },
                          amount: { type: 'integer' },
                          currency: { type: 'string' },
                          createdAt: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или нет права управлять содержимым (forbidden.*)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const eventBalance = await eventBalanceService.get(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
  )
  return { eventBalance }
})
