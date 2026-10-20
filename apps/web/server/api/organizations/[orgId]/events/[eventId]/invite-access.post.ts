import { eventInviteService, requireOrgMember } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Состояние записи по приглашению',
    description:
      'Для экрана игрока события joinMode=invite (20.4.7, D-06): none | requested | invited | ' +
      'expired, свой последний запрос, срок и имя пригласившего, организатор. Только чтение: токен ' +
      '(startapp event_<id>_<token>) передаётся в теле, не расходуется и не возвращается. Чужой, ' +
      'неизвестный, отозванный или использованный токен ничего не показывает.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'eventId', required: true, schema: { type: 'integer' } },
    ],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: { type: 'object', properties: { inviteToken: { type: 'string' } } },
        },
      },
    },
    responses: {
      200: { description: 'Состояние: { access }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы' },
      404: { description: 'Событие не найдено в этой группе или черновик (event.not_found)' },
      409: { description: 'Свободная запись (event.join_mode_open)' },
      422: { description: 'Неверное тело' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const eventId = pathId(getRouterParam(event, 'eventId'))
  const body = (await readBody(event)) ?? {}
  const access = await eventInviteService.access(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    eventId,
    body,
  )
  return { access }
})
