import { memberService, requireCanManageContent, SetMemberLevelInput } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['members'],
    summary: 'Назначить уровень игрока в группе',
    description:
      'Владелец и организатор назначают или снимают (level: null) уровень В1–В4+ участника этой группы. ' +
      'Уровень не назначается заблокированным, вышедшим и отклонённым. Изменение пишется в историю ' +
      '(audit_log, member.level_changed). Текущий уровень отдаёт список участников (поле level).',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'memberId', required: true, schema: { type: 'integer' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['level'],
            properties: {
              level: {
                type: 'string',
                enum: ['v1', 'v2', 'v3', 'v4', 'v4_plus'],
                nullable: true,
                description: 'код из GET /api/levels; null снимает уровень',
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Участник с новым уровнем: { member }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или нет права управлять содержимым' },
      404: { description: 'Участник не найден в этой группе (member.not_found)' },
      409: { description: 'Участнику нельзя назначить уровень (member.level_not_assignable)' },
      422: { description: 'Неизвестный код уровня (validation_failed)' },
    },
  },
})

/** Уровень игрока: org-scope → право управлять содержимым (owner/organizer) → запись с audit. */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const memberId = Number(getRouterParam(event, 'memberId'))
  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid memberId' })
  }
  const input = SetMemberLevelInput.parse(await readBody(event))
  const member = await memberService.setLevel(ctx, memberId, input)
  return { member }
})
