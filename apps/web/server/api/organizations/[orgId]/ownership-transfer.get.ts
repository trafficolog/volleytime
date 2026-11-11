import { ownershipTransferService, requireOrgOwner, restoreWindowDays } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Ожидающая передача владения группой',
    description:
      '21.2.17 (D-15). Текущая ожидающая передача: получатель и срок ссылки, либо null. Ссылку ' +
      'повторно получить нельзя (токен хранится хешем): если она потеряна — отменить передачу и ' +
      'начать новую. restoreWindowDays — окно восстановления после удаления группы. Только владелец.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: {
        description:
          '{ transfer: { id, toUserId, toMemberId, toName, expiresAt, botDelivery } | null, restoreWindowDays }',
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не владелец группы (forbidden.owner_only)' },
      410: { description: 'Группа в архиве или удалена' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const transfer = await ownershipTransferService.current(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
  )
  return { transfer, restoreWindowDays: restoreWindowDays() }
})
