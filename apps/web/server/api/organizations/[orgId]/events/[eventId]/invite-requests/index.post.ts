import { eventInviteRequestService, requireOrgMember } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Запросить приглашение на событие',
    description:
      'Игрок просит приглашение на событие joinMode=invite (P-07, 20.1.3). Один ожидающий запрос на ' +
      'игрока и событие; после отказа можно запросить снова. Одобрение выдаёт игроку однократное ' +
      'приглашение — запись проходит без токена.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'eventId', required: true, schema: { type: 'integer' } },
    ],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { message: { type: 'string', description: 'до 500 символов' } },
          },
        },
      },
    },
    responses: {
      200: { description: 'Созданный запрос: { request }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы' },
      404: { description: 'Событие не найдено в этой группе или черновик (event.not_found)' },
      409: {
        description:
          'Свободная запись (event.join_mode_open), уже записан (booking.already_booked), ' +
          'запрос уже ждёт ответа (invite_request.already_pending)',
      },
      422: { description: 'Запись закрыта (booking.event_not_bookable), неверное тело' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const eventId = pathId(getRouterParam(event, 'eventId'))
  const body = (await readBody(event)) ?? {}
  const request = await eventInviteRequestService.request(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    eventId,
    body,
  )
  return { request }
})
