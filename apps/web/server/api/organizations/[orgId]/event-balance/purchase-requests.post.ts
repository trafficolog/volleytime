import { CreatePurchaseRequestInput, eventBalanceService, requireOrgOwner } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['event-balance'],
    summary: 'Заявка на покупку пакета баланса событий',
    description:
      'Владелец группы создаёт заявку на пакет из каталога (без онлайн-оплаты, D-07). Количество и ' +
      'цена берутся из каталога и сохраняются снимком. Баланс пополняется только после ' +
      'подтверждения заявки root (операторская команда, затем UI 22.2.2/22.2.3).',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['packageCode'],
            additionalProperties: false,
            properties: {
              packageCode: { type: 'string', enum: ['events_10', 'events_30', 'events_100'] },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Заявка в статусе pending: { purchaseRequest }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или не владелец (forbidden.owner_only)' },
      422: { description: 'Неизвестный пакет или лишние поля (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const input = CreatePurchaseRequestInput.parse(await readBody(event))
  const purchaseRequest = await eventBalanceService.createPurchaseRequest(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    input,
  )
  return { purchaseRequest }
})
