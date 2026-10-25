import { eventInviteRequestService, requireOrgMember } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Отозвать свой запрос приглашения',
    description:
      'Игрок отзывает свой ожидающий запрос (20.4.7); потом можно запросить снова. Только автор и ' +
      'только из статуса pending.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'eventId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'requestId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: 'Запрос после отзыва: { request }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы' },
      404: {
        description:
          'Событие, запрос или чужой запрос не найдены (event.not_found, invite_request.not_found)',
      },
      409: { description: 'Запрос уже решён или отозван (invite_request.not_pending)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const eventId = pathId(getRouterParam(event, 'eventId'))
  const requestId = pathId(getRouterParam(event, 'requestId'))
  const request = await eventInviteRequestService.cancel(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    eventId,
    requestId,
  )
  return { request }
})
