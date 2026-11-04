import { canManageContent, collectionService, requireOrgMember } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['collections'],
    summary: 'Сбор с итогами и взносами',
    description:
      '21.2.4: сбор, итоги и взносы (подтверждённые и обещания; игрок — только id, имя, username и ' +
      'аватар). Черновик и сбор другой группы — 404 collection.not_found. Любой активный участник.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'collectionId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ collection, contributions }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы (forbidden.*)' },
      404: { description: 'Сбор не найден в этой группе (collection.not_found)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const member = event.context.member ?? null
  requireOrgMember(member)
  return collectionService.get(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    pathId(getRouterParam(event, 'collectionId')),
    { manager: canManageContent(member) },
  )
})
