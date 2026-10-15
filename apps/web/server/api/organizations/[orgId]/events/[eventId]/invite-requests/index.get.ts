import { eventInviteRequestService, requireCanManageContent } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Запросы приглашения на событие',
    description:
      'Запросы игроков на событие (20.1.3), сначала старые. Игрок — только публичные поля ' +
      '(имя, Telegram username, аватар). Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'eventId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: 'Список: { requests }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'Событие не найдено в этой группе (event.not_found)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const eventId = pathId(getRouterParam(event, 'eventId'))
  const requests = await eventInviteRequestService.list(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    eventId,
  )
  return { requests }
})
