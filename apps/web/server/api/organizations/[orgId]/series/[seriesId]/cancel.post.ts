import { requireCanManageContent, seriesService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Отменить дату серии и все последующие',
    description:
      'P-06, 20.2.2 (решение владельца 2026-10-15): одной командой отменяет даты серии от from, ' +
      'кроме уже отменённых и завершённых. Для каждого события — как POST …/events/{id}/cancel: ' +
      'возврат баланса по D-09/D-13, записи и платежи по R0.7. Повтор безопасен. Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'seriesId', required: true, schema: { type: 'integer' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['from'],
            properties: { from: { type: 'string', format: 'date' } },
          },
        },
      },
    },
    responses: {
      200: { description: '{ cancelled, balanceRefunds, events }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'Серия не найдена в этой группе (series.not_found)' },
      422: { description: 'Неверное тело' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const seriesId = pathId(getRouterParam(event, 'seriesId'))
  const body = await readBody(event)
  const ctx = createServiceContextFromEvent(event)
  return withNotifications((notifications) =>
    seriesService.cancel({ ...ctx, notifications }, event.context.organization!.id, seriesId, body),
  )
})
