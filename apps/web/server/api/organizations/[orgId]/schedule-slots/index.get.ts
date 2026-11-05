import { requireCanManageContent, scheduleSlotService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['schedule-slots'],
    summary: 'Слоты расписания группы',
    description:
      '21.2.12: шаблоны регулярных тренировок (день недели, время, формат, зал, места) для формы ' +
      'создания события и серии. Слоты сами событий не создают. Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: {
        description:
          '{ slots: [{ id, weekday, startTime, durationMinutes, title, type, capacity, venueId, venueName, venueArchived }] }',
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const slots = await scheduleSlotService.list(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
  )
  return { slots }
})
