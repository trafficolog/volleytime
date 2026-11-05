import { requireCanManageContent, venueService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['venues'],
    summary: 'Удалить зал группы (или отправить в архив)',
    description:
      '21.2.13: зал без событий и серий удаляется (outcome=deleted); зал, на который ссылаются ' +
      'события или серии, переводится в архив (outcome=archived) и остаётся на событиях. ' +
      'Зал чужой группы — 404. Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'venueId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ outcome: "deleted" | "archived", venue }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'venue.not_found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const venueId = pathId(getRouterParam(event, 'venueId'))
  return venueService.remove(
    createServiceContextFromEvent(event),
    venueId,
    event.context.organization!.id,
  )
})
