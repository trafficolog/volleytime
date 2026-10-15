import { eventInviteRequestService, requireCanManageContent } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Отклонить запрос приглашения',
    description:
      'Игрок может запросить снова. Только из статуса pending (20.1.3). Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'eventId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'requestId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: 'Запрос после решения: { request }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: {
        description:
          'Событие или запрос не найдены в этой группе и событии (event.not_found, invite_request.not_found)',
      },
      409: { description: 'Запрос уже решён (invite_request.not_pending)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const eventId = pathId(getRouterParam(event, 'eventId'))
  const requestId = pathId(getRouterParam(event, 'requestId'))
  const request = await eventInviteRequestService.decline(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    eventId,
    requestId,
  )
  return { request }
})
