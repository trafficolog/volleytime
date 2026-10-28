import { collectionService, requireCanManageContent } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['collections'],
    summary: 'Отменить сбор',
    description:
      '21.2.4: черновик или активный сбор → cancelled; ожидающие обещания отклоняются в той же ' +
      'транзакции; подтверждённые взносы и касса не меняются. Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'collectionId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ collection }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'Сбор не найден в этой группе (collection.not_found)' },
      409: { description: 'Сбор уже закрыт (collection.not_active)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const collection = await collectionService.cancel(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    pathId(getRouterParam(event, 'collectionId')),
  )
  return { collection }
})
