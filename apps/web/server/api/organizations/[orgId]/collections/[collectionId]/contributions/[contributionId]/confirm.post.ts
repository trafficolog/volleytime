import { collectionService, requireCanManageContent } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['collections'],
    summary: 'Подтвердить взнос',
    description:
      '21.2.4: взнос (платёж сбора) pending → succeeded и ровно одна запись кассы contribution. ' +
      'Повтор и гонка — 409 payment.not_pending. Взнос другого сбора или группы — 404. ' +
      'Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'collectionId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'contributionId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ contribution }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'collection.not_found, payment.not_found' },
      409: { description: 'payment.not_pending' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const collectionId = pathId(getRouterParam(event, 'collectionId'))
  const contributionId = pathId(getRouterParam(event, 'contributionId'))
  const ctx = createServiceContextFromEvent(event)
  const contribution = await withNotifications((notifications) =>
    collectionService.confirmContribution(
      { ...ctx, notifications },
      event.context.organization!.id,
      collectionId,
      contributionId,
    ),
  )
  return { contribution }
})
