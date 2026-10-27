import { canManageContent, collectionService, requireOrgMember } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['collections'],
    summary: 'Сборы группы',
    description:
      '21.2.4: сборы от новых к старым с итогами — собрано (подтверждённые взносы = касса по сбору), ' +
      'обещано, число участников и свои взносы. Черновики видит только владелец и организатор. ' +
      'Keyset-пагинация. Любой активный участник.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      {
        in: 'query',
        name: 'limit',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
      { in: 'query', name: 'cursor', required: false, schema: { type: 'string' } },
    ],
    responses: {
      200: { description: '{ collections, nextCursor }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы (forbidden.*)' },
      422: { description: 'Невалидный limit или cursor (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const member = event.context.member ?? null
  requireOrgMember(member)
  return collectionService.list(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    getQuery(event),
    { manager: canManageContent(member) },
  )
})
