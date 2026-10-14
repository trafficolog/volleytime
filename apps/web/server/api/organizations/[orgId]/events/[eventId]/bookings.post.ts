import { bookingService, requireOrgMember } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['bookings'],
    summary: 'Записаться на событие',
    description:
      'Запись текущего пользователя на `seats` мест (по умолчанию 1; больше одного — только при ' +
      'EVENT_MULTI_SEAT_ENABLED=true, не больше лимита группы и вместимости). Fixed cash/transfer — ' +
      'один платёж на место. Мест нет — запись целиком в очередь. Свободных меньше, чем выбрано, — ' +
      '409 booking.not_enough_seats, если не передано allowWaitlist: true (тогда часть мест в основу, ' +
      'остальные в очередь).',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'eventId', required: true, schema: { type: 'integer' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['method'],
            properties: {
              method: { type: 'string', enum: ['subscription', 'cash', 'transfer', 'free'] },
              subscriptionId: { type: 'integer' },
              seats: { type: 'integer', minimum: 1, maximum: 10, default: 1 },
              allowWaitlist: { type: 'boolean', default: false },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Созданная или реактивированная запись: { booking }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы' },
      404: { description: 'Событие не найдено в этой группе (event.not_found)' },
      409: {
        description:
          'Уже записан (booking.already_booked), мало свободных мест без согласия на очередь ' +
          '(booking.not_enough_seats), не хватает занятий абонемента ' +
          '(subscription.no_active, subscription.not_enough_sessions) или несколько мест выключены ' +
          '(booking.multi_seat_disabled)',
      },
      422: {
        description:
          'Больше лимита группы или вместимости (booking.seats_over_limit), запись закрыта ' +
          '(booking.event_not_bookable), способ оплаты недоступен (booking.method_not_allowed), ' +
          'неверное тело (validation_failed)',
      },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const eventId = Number(getRouterParam(event, 'eventId'))
  const body = await readBody(event)
  const booking = await withNotifications((notifications) =>
    bookingService.book({ ...ctx, notifications }, event.context.organization!.id, eventId, body),
  )
  return { booking }
})
