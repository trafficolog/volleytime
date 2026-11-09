import { ownershipTransferService, requireOrgOwner } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Начать передачу владения группой',
    description:
      '21.2.17 (D-15). Владелец выбирает действующего участника группы (recipientMemberId — id ' +
      'участника из списка игроков). Создаётся ожидающая передача и личная ссылка: одноразовая, ' +
      'привязанная к получателю, со сроком 72 часа. Ссылка возвращается только в этом ответе ' +
      '(links.telegram — Mini App, links.web — браузер; токен во фрагменте адреса не уходит на ' +
      'сервер); владелец передаёт её получателю сам. До принятия владелец не меняется. Не больше ' +
      'одной ожидающей передачи (409 ownership_transfer.pending_exists); себе, не участнику и не ' +
      'действующему участнику — 422 ownership_transfer.recipient_invalid. Только владелец.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { recipientMemberId: { type: 'integer' } },
            required: ['recipientMemberId'],
          },
        },
      },
    },
    responses: {
      200: { description: '{ transfer, links: { telegram, web } }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не владелец группы (forbidden.owner_only)' },
      409: { description: 'Уже есть ожидающая передача (ownership_transfer.pending_exists)' },
      410: { description: 'Группа в архиве или удалена' },
      422: { description: 'Недопустимый получатель (ownership_transfer.recipient_invalid)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const body = await readBody(event)
  const { transfer, token } = await ownershipTransferService.start(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    body ?? {},
  )
  return { transfer, links: transferLinks(token) }
})
