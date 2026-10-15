import { requireCanManageContent, seriesService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Серия событий с датами',
    description:
      'P-06, 20.2.2: правило, исключения, шаблон, часовой пояс и даты серии (включая черновики). ' +
      'Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'seriesId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ series, events }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'Серия не найдена в этой группе (series.not_found)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const seriesId = pathId(getRouterParam(event, 'seriesId'))
  return seriesService.get(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    seriesId,
  )
})
