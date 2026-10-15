import { requireCanManageContent, seriesService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Правка серии: только это или это и последующие',
    description:
      'P-06, 20.2.2: scope=single — событие даты from; scope=following — даты от from, кроме ' +
      'прошедших, отменённых и завершённых, и шаблон серии. Поля: title, description, venueId, ' +
      'locationText, startTime (HH:MM по часам группы), durationMinutes, capacity, priceMode, price, ' +
      'targetAmount, level, joinMode. Атомарно: ошибка на любой дате откатывает всю правку. ' +
      'Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'seriesId', required: true, schema: { type: 'integer' } },
      {
        in: 'query',
        name: 'scope',
        required: true,
        schema: { type: 'string', enum: ['single', 'following'] },
      },
      { in: 'query', name: 'from', required: true, schema: { type: 'string', format: 'date' } },
    ],
    responses: {
      200: { description: '{ updated, events }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'series.not_found; event.not_found — нет даты from (scope=single)' },
      409: { description: 'event.not_editable, event.pricing_locked и другие правила события' },
      422: { description: 'event.capacity_below_taken, event.starts_in_past, неверное тело' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const seriesId = pathId(getRouterParam(event, 'seriesId'))
  const body = await readBody(event)
  return seriesService.update(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    seriesId,
    getQuery(event) as never,
    body,
  )
})
