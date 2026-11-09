import { ownershipTransferService, requireOrgOwner } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Отменить передачу владения группой',
    description:
      '21.2.17 (D-15). Отменяет ожидающую передачу: ссылка сразу перестаёт работать, владелец не ' +
      'меняется. Повтор или нечего отменять — cancelled: false без изменений. Только владелец.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ cancelled: boolean }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не владелец группы (forbidden.owner_only)' },
      410: { description: 'Группа в архиве или удалена' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  return ownershipTransferService.cancel(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
  )
})
