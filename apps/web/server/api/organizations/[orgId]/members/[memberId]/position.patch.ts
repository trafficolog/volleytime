import { memberService, requireCanManageContent, SetMemberPositionInput } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['members'],
    summary: 'Назначить амплуа игрока в группе',
    description:
      'Владелец и организатор назначают или снимают (position: null) амплуа участника этой группы. ' +
      'Игрок своё амплуа видит (список участников, поле position; профиль, myMember.position), ' +
      'но записать его не может. Амплуа не назначается заблокированным, вышедшим и отклонённым. ' +
      'Изменение пишется в историю (audit_log, member.position_changed).',
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
            required: ['position'],
            properties: {
              position: {
                type: 'string',
                enum: [
                  'setter',
                  'outside_hitter',
                  'opposite',
                  'middle_blocker',
                  'libero',
                  'utility',
                ],
                nullable: true,
                description:
                  'связующий, доигровщик, диагональный, центральный блокирующий, либеро, универсал; null снимает амплуа',
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Участник с новым амплуа: { member }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или нет права управлять содержимым' },
      404: { description: 'Участник не найден в этой группе (member.not_found)' },
      409: { description: 'Участнику нельзя назначить амплуа (member.position_not_assignable)' },
      422: { description: 'Неизвестный код амплуа (validation_failed)' },
    },
  },
})

/** Амплуа игрока: org-scope → право управлять содержимым (owner/organizer) → запись с audit. */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const memberId = Number(getRouterParam(event, 'memberId'))
  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid memberId' })
  }
  const input = SetMemberPositionInput.parse(await readBody(event))
  const member = await memberService.setPosition(ctx, memberId, input)
  return { member }
})
