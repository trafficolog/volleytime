import { eventBalanceService, requireCanManageContent } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['event-balance'],
    summary: 'История операций баланса событий',
    description:
      'Журнал операций (append-only) от новых к старым: причина, изменение, остаток после операции, ' +
      'автор (пользователь или система) и событие. Keyset-пагинация. Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      {
        in: 'query',
        name: 'limit',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
      {
        in: 'query',
        name: 'cursor',
        required: false,
        schema: { type: 'string' },
        description: 'nextCursor из предыдущей страницы',
      },
    ],
    responses: {
      200: {
        description: '{ entries, nextCursor }',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['entries', 'nextCursor'],
              properties: {
                entries: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      delta: { type: 'integer' },
                      reason: {
                        type: 'string',
                        enum: [
                          'demo_grant',
                          'pilot_grant',
                          'purchase',
                          'grant',
                          'spend',
                          'refund',
                          'correction',
                        ],
                      },
                      balanceAfter: { type: 'integer' },
                      actorKind: { type: 'string', enum: ['user', 'system'] },
                      author: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string', nullable: true },
                        },
                      },
                      source: { type: 'string', nullable: true },
                      comment: { type: 'string', nullable: true },
                      event: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          id: { type: 'integer' },
                          title: { type: 'string' },
                          startsAt: { type: 'string', format: 'date-time' },
                        },
                      },
                      purchaseRequestId: { type: 'integer', nullable: true },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                nextCursor: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или нет права управлять содержимым (forbidden.*)' },
      422: { description: 'Невалидный limit или cursor (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  return eventBalanceService.listEntries(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    getQuery(event),
  )
})
