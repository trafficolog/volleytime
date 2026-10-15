import { eventInviteService, requireCanManageContent } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Личная ссылка-приглашение на событие',
    description:
      'Однократное приглашение на событие joinMode=invite (P-07, 20.1.3). Срок — expiresInHours ' +
      '(1..720) или до начала события, не позже начала. startParam — параметр startapp Mini App ' +
      '`event_<eventId>_<token>`. Владелец и организатор.',
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
            properties: { expiresInHours: { type: 'integer', minimum: 1, maximum: 720 } },
          },
        },
      },
    },
    responses: {
      200: { description: 'Приглашение: { invite, startParam }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'Событие не найдено в этой группе (event.not_found)' },
      409: { description: 'Событие со свободной записью (event.join_mode_open)' },
      422: {
        description:
          'Событие отменено, завершено или уже началось (booking.event_not_bookable), неверное тело',
      },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const eventId = pathId(getRouterParam(event, 'eventId'))
  const body = (await readBody(event)) ?? {}
  return eventInviteService.create(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    eventId,
    body,
  )
})
