import { requireCanManageContent, scheduleSlotService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['schedule-slots'],
    summary: 'Удалить слот расписания',
    description:
      '21.2.12: удаляет только шаблон; созданные по нему события и серии не меняются. Слот чужой ' +
      'группы — 404. Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'slotId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ ok: true }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'schedule_slot.not_found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const slotId = pathId(getRouterParam(event, 'slotId'))
  await scheduleSlotService.remove(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    slotId,
  )
  return { ok: true }
})
