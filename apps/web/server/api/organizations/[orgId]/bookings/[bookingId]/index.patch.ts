import { bookingService, requireOrgMember } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['bookings'],
    summary: 'Изменить число мест своей записи',
    description:
      'Игрок меняет общее число мест своей записи (основа + очередь). Уменьшение — частичная отмена: ' +
      'сначала снимаются места в очереди, затем места основы (неоплаченные — отменяются, оплаченные ' +
      'освобождаются без автоматического возврата, D-14), освободившиеся места уходят первым в очереди. ' +
      'Увеличение — только в основу при достаточном числе свободных мест. После фиксации split места ' +
      'не меняются. Больше одного места — только при EVENT_MULTI_SEAT_ENABLED=true.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'bookingId', required: true, schema: { type: 'integer' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['seats'],
            additionalProperties: false,
            properties: { seats: { type: 'integer', minimum: 1, maximum: 10 } },
          },
        },
      },
    },
    responses: {
      200: {
        description:
          'Запись после изменения и первая продвинутая из очереди: { booking, promoted }',
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или чужая запись (booking.cannot_cancel_others)' },
      404: { description: 'Запись не найдена в этой группе (booking.not_found)' },
      409: {
        description:
          'Мало свободных мест (booking.not_enough_seats), занятий абонемента ' +
          '(subscription.not_enough_sessions), запись нельзя менять (booking.not_cancellable) ' +
          'или несколько мест выключены (booking.multi_seat_disabled)',
      },
      422: {
        description:
          'Больше лимита группы или вместимости (booking.seats_over_limit), срок отмены прошёл ' +
          '(booking.deadline_passed), отмена запрещена политикой (booking.cancellation_not_allowed), ' +
          'неверное тело (validation_failed)',
      },
    },
  },
})

/**
 * Изменить число мест своей записи (20.1.2, P-05): `{ seats }` — новое общее число мест.
 * Право — self (permissions-v3): чужая запись своей группы — 403, чужой группы — 404.
 */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const bookingId = Number(getRouterParam(event, 'bookingId'))
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid bookingId' })
  }
  const booking = await bookingService.getById(ctx, bookingId)
  if (booking.organizationId !== event.context.organization!.id) {
    throw createError({ statusCode: 404, statusMessage: 'Booking not found' })
  }
  const body = await readBody(event)
  const result = await withNotifications((notifications) =>
    bookingService.changeSeats({ ...ctx, notifications }, bookingId, body),
  )
  return { booking: result.booking, promoted: result.promoted }
})
