import { requireCanManageContent, venueService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['venues'],
    summary: 'Правка зала группы',
    description:
      '21.2.13: name, address, capacityHint, notes (address/capacityHint/notes можно сбросить в null). ' +
      'Статус зала не меняется. Зал чужой группы — 404. Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'venueId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ venue }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'venue.not_found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const venueId = pathId(getRouterParam(event, 'venueId'))
  const body = await readBody(event)
  const venue = await venueService.update(
    createServiceContextFromEvent(event),
    venueId,
    body,
    event.context.organization!.id,
  )
  return { venue }
})
