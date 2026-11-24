import {
  UpdateMemberInput,
  inTransaction,
  memberRoles,
  memberService,
  normalizeRole,
  requireCanManageMembers,
  requireOrgOwner,
} from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['members'],
    summary: 'Роль участника и флаг «Принимает оплату»',
    description:
      '30.1.1 (P-18): `role` (organizer, coach, player) меняет только владелец; `role: player` — ' +
      '«Убрать из команды», человек остаётся игроком группы. `canAcceptPayment` выдают владелец ' +
      'и организатор, только активному тренеру. Каждое изменение пишется в журнал с автором.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'memberId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ member: { id, role, roles, canAcceptPayment, status, ... } }' },
      403: { description: 'Роль меняет только владелец; флаг — владелец или организатор' },
      404: { description: 'Участник не найден или из другой группы' },
      422: { description: 'Владелец, своя роль или флаг у не-тренера' },
    },
  },
})

/** Смена роли — только владелец, флаг оплаты — владелец или организатор (4.9.1, 30.1.1). */
export default defineApiHandler(async (event) => {
  const member = event.context.member ?? null
  const input = UpdateMemberInput.parse(await readBody(event))
  if (input.role !== undefined) requireOrgOwner(member)
  else requireCanManageMembers(member)
  const ctx = createServiceContextFromEvent(event)
  const memberId = Number(getRouterParam(event, 'memberId'))
  const target = await memberService.getById(ctx, memberId)
  if (target.organizationId !== event.context.organization!.id) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }
  const updated = await inTransaction(ctx, async (tx) => {
    let m = target
    if (input.role !== undefined) m = await memberService.changeRole(tx, memberId, input.role)
    if (input.canAcceptPayment !== undefined) {
      m = await memberService.setAcceptPayment(tx, memberId, input.canAcceptPayment)
    }
    return m
  })
  const role = normalizeRole(updated.role)
  return {
    member: {
      ...updated,
      role,
      roles: memberRoles(updated),
      canAcceptPayment: role === 'coach' && updated.canAcceptPayment,
    },
  }
})
