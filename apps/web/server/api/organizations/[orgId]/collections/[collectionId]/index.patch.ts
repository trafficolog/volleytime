import { collectionService, requireCanManageContent } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['collections'],
    summary: 'Изменить сбор',
    description:
      '21.2.4: название, описание, иконка, цель (null — без цели), дедлайн; status: active публикует ' +
      'черновик. Завершённый и отменённый сбор не меняются (409 collection.not_active). ' +
      'Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'collectionId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ collection }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'Сбор не найден в этой группе (collection.not_found)' },
      409: { description: 'collection.not_active' },
      422: { description: 'Неверное тело (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const collection = await collectionService.update(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    pathId(getRouterParam(event, 'collectionId')),
    (await readBody(event)) ?? {},
  )
  return { collection }
})
