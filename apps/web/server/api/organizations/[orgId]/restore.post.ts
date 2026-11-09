import { organizationDeletionService, requireOrgOwner } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Восстановить удалённую группу',
    description:
      '21.2.17 (D-15). В окне восстановления владелец возвращает группу: снимается пометка ' +
      'удаления, всё остальное остаётся как было (деньги не пересчитываются). После окна — 410 ' +
      'organization.restore_window_closed; группа не удалена — 409 organization.not_deleted. ' +
      'Единственный изменяющий маршрут, доступный владельцу удалённой группы.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ restoredAt }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не владелец группы (forbidden.owner_only)' },
      409: { description: 'Группа не удалена (organization.not_deleted)' },
      410: { description: 'Окно восстановления закончилось или группа в архиве' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  return organizationDeletionService.restore(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
  )
})
