import { requireCanManageContent, scheduleSlotService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['schedule-slots'],
    summary: 'Добавить слот расписания',
    description:
      '21.2.12: weekday (ISO 1-7), startTime (HH:MM), title, capacity; durationMinutes (по ' +
      'умолчанию 120), type, venueId (активный зал этой группы) необязательны. Не создаёт событий ' +
      'и не списывает баланс. Не больше 50 слотов на группу. Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ slot }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      422: {
        description:
          'validation_failed, event.venue_not_in_org, event.venue_archived, schedule_slot.limit_reached',
      },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const body = await readBody(event)
  const slot = await scheduleSlotService.create(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    body,
  )
  return { slot }
})
