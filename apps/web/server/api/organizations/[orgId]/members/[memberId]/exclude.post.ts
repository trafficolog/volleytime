import { excludeMember, ExcludeMemberInput, requireCanManageMembers } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['members'],
    summary: 'Исключить игрока из группы (без блокировки)',
    description:
      'Владелец и организатор снимают членство игрока: будущие записи отменяются (места ' +
      'освобождаются, очередь продвигается, оплаченные места автоматически не возвращаются), ' +
      'игрок снимается с листов ожидания и теряет неиспользованные ссылки-приглашения, получает ' +
      'уведомление. Абонемент, долг, платежи и история остаются. Игрок не заблокирован и может ' +
      'вернуться по приглашению. Владельца и себя исключить нельзя; администраторов исключает ' +
      'только владелец. Пишется в audit_log (member.excluded) с исполнителем и причиной.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'memberId', required: true, schema: { type: 'integer' } },
    ],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { reason: { type: 'string', maxLength: 500 } },
          },
        },
      },
    },
    responses: {
      200: {
        description:
          '{ member, cancelledBookings, paidSeats, revokedInvites }: paidSeats вернуть вручную',
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Нет права исключать этого участника (forbidden.exclude и др.)' },
      404: { description: 'Участник не найден в этой группе (member.not_found)' },
      409: { description: 'Участника в этом статусе исключить нельзя (member.invalid_transition)' },
      422: { description: 'Владельца и себя исключить нельзя (member.cannot_exclude_*)' },
    },
  },
})

/** Исключение из группы: org-scope → право управлять участниками → транзакция сервиса. */
export default defineApiHandler(async (event) => {
  requireCanManageMembers(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const memberId = pathId(getRouterParam(event, 'memberId'))
  const input = ExcludeMemberInput.parse((await readBody(event).catch(() => null)) ?? {})
  return withNotifications((notifications) =>
    excludeMember({ ...ctx, notifications }, memberId, input),
  )
})
