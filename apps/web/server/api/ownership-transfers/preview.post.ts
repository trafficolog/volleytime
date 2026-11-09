import { ownershipTransferService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Предпросмотр передачи владения по личной ссылке',
    description:
      '21.2.17 (D-15). Токен ссылки — в теле, не в адресе (не попадает в журналы доступа). ' +
      'Отвечает только получателю: status pending/accepted/cancelled/expired, группа, кто передаёт ' +
      'и срок. Чужая и неизвестная ссылки неотличимы: status invalid без данных.',
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
      200: { description: '{ status, organization: { id, name } | null, fromName, expiresAt }' },
      401: { description: 'Нет сессии' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const body = (await readBody(event)) as { token?: unknown } | null
  return ownershipTransferService.preview({ userId: user.id }, body?.token)
})
