import { requireCanManageContent, scheduleSlotService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['schedule-slots'],
    summary: 'Правка слота расписания',
    description:
      '21.2.12: любые поля слота; venueId можно сбросить в null. Новый зал — активный зал этой ' +
      'группы. Слот чужой группы — 404. Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'slotId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ slot }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'schedule_slot.not_found' },
      422: { description: 'validation_failed, event.venue_not_in_org, event.venue_archived' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const slotId = pathId(getRouterParam(event, 'slotId'))
  const body = await readBody(event)
  const slot = await scheduleSlotService.update(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    slotId,
    body,
  )
  return { slot }
})
