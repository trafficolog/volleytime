import { ownershipTransferService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Принять передачу владения по личной ссылке',
    description:
      '21.2.17 (D-15). Принять может только получатель, вошедший под своей учётной записью; токен — ' +
      'в теле. В одной транзакции получатель становится владельцем, прежний владелец — ' +
      'организатором. Чужая или неизвестная ссылка — 404 ownership_transfer.invalid; использованная ' +
      '— 409 ownership_transfer.used; истёкшая и отменённая — 410; получатель больше не участник — ' +
      '409 ownership_transfer.recipient_not_member.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { token: { type: 'string' } },
            required: ['token'],
          },
        },
      },
    },
    responses: {
      200: { description: '{ organizationId }' },
      401: { description: 'Нет сессии' },
      404: { description: 'Ссылка не найдена или выдана другому (ownership_transfer.invalid)' },
      409: { description: 'Ссылка уже использована или получатель больше не участник' },
      410: { description: 'Срок истёк или передача отменена' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const body = (await readBody(event)) as { token?: unknown } | null
  return ownershipTransferService.accept({ userId: user.id }, body?.token)
})
