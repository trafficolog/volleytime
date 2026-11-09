import { organizationDeletionService, requireOrgOwner } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Удалить группу (мягко, с окном восстановления)',
    description:
      '21.2.17 (D-15). Владелец подтверждает удаление вводом названия группы (confirmName; 422 ' +
      'organization.delete_confirmation_mismatch, если не совпадает). Группа помечается удалённой ' +
      'до restoreUntil (по умолчанию 30 дней, GROUP_RESTORE_WINDOW_DAYS): скрыта от участников, из ' +
      'шторки групп и публичных страниц; запись, оплата и уведомления по ней блокируются, фоновые ' +
      'задачи её пропускают. Деньги не меняются: баланс событий, касса, абонементы и платежи ' +
      'остаются как были. При ожидающей передаче владения — 409 organization.transfer_pending. ' +
      'Окончательная очистка после окна не выполняется. Только владелец.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { confirmName: { type: 'string' } },
            required: ['confirmName'],
          },
        },
      },
    },
    responses: {
      200: { description: '{ deletedAt, restoreUntil }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не владелец группы (forbidden.owner_only)' },
      409: { description: 'Ожидающая передача владения (organization.transfer_pending)' },
      410: { description: 'Группа в архиве или уже удалена' },
      422: { description: 'Название не совпадает (organization.delete_confirmation_mismatch)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const body = await readBody(event)
  return organizationDeletionService.delete(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    body ?? {},
  )
})
