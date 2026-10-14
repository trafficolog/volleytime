import {
  canManageContent,
  EventPriceQuery,
  readEventPriceQuote,
  requireOrgMember,
} from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Цена места события',
    description:
      'Единый расчёт цены (P-03) для Mini App, кабинета и публичной страницы. fixed — цена × места; ' +
      'split до закрытия записи — прогноз «от … до …» между долей при полном составе и долей при ' +
      'текущем составе с местами игрока; после закрытия — зафиксированная доля игрока (точное ' +
      'распределение копеек, D-01). Деньги — целые минимальные единицы + currency. ' +
      'Черновики видят только владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'eventId', required: true, schema: { type: 'integer' } },
      {
        in: 'query',
        name: 'seats',
        required: false,
        description: 'число мест игрока; по умолчанию — места его записи или 1',
        schema: { type: 'integer', minimum: 1, maximum: 10 },
      },
    ],
    responses: {
      200: {
        description: 'Цена: { price }',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['price'],
              properties: {
                price: {
                  type: 'object',
                  properties: {
                    mode: { type: 'string', enum: ['fixed', 'split'] },
                    basis: { type: 'string', enum: ['fixed', 'forecast', 'settled'] },
                    seats: { type: 'integer' },
                    perSeat: {
                      type: 'object',
                      properties: { min: { type: 'integer' }, max: { type: 'integer' } },
                    },
                    total: {
                      type: 'object',
                      properties: { min: { type: 'integer' }, max: { type: 'integer' } },
                    },
                    seatCount: {
                      type: 'object',
                      nullable: true,
                      properties: { current: { type: 'integer' }, max: { type: 'integer' } },
                    },
                    targetAmount: { type: 'integer', nullable: true },
                    subscriptionApplicable: { type: 'boolean' },
                    currency: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы (forbidden.*)' },
      404: {
        description: 'Событие не найдено в этой группе или скрытый черновик (event.not_found)',
      },
      422: {
        description:
          'seats не целое 1..10 (validation_failed) или больше лимита группы/вместимости (booking.seats_over_limit)',
      },
    },
  },
})

/** Цена места: участник группы → событие этой группы (чужое — 404) → единый расчёт. */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const eventId = Number(getRouterParam(event, 'eventId'))
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  const query = EventPriceQuery.parse(getQuery(event))
  const price = await readEventPriceQuote(createServiceContextFromEvent(event), {
    organizationId: event.context.organization!.id,
    eventId,
    seats: query.seats,
    includeDrafts: canManageContent(event.context.member ?? null),
  })
  return { price }
})
