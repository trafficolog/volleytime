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
  const collectionId = pathId(getRouterParam(event, 'collectionId'))
  const ctx = createServiceContextFromEvent(event)
  // отклонённые обещания: уведомления игрокам после коммита (collect-then-notify)
  const collection = await withNotifications((notifications) =>
    collectionService.cancel(
      { ...ctx, notifications },
      event.context.organization!.id,
      collectionId,
    ),
  )
  return { collection }
})
