import { collectionService, requireOrgMember } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['collections'],
    summary: 'Внести взнос в сбор',
    description:
      '21.2.4: свой взнос в активный сбор — обещание (pending-платёж) до подтверждения организатором. ' +
      'Одно ожидающее обещание игрока в сборе: повтор до подтверждения меняет сумму и способ ' +
      '(replaced = true). Только при COLLECTIONS_ENABLED=true. Любой активный участник.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'collectionId', required: true, schema: { type: 'integer' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['amount', 'method'],
            properties: {
              amount: { type: 'integer', minimum: 1, maximum: 10000000 },
              method: { type: 'string', enum: ['cash', 'transfer'] },
            },
          },
        },
      },
    },
    responses: {
      200: { description: '{ contribution, replaced }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы (forbidden.*)' },
      404: { description: 'Сбор не найден в этой группе (collection.not_found)' },
      409: { description: 'collection.not_active, collection.disabled' },
      422: { description: 'Неверное тело (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const collectionId = pathId(getRouterParam(event, 'collectionId'))
  const body = (await readBody(event)) ?? {}
  const ctx = createServiceContextFromEvent(event)
  return withNotifications((notifications) =>
    collectionService.contribute(
      { ...ctx, notifications },
      event.context.organization!.id,
      collectionId,
      body,
    ),
  )
})
