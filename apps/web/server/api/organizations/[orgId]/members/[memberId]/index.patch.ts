import { ChangeMemberRoleInput, memberService, requireOrgOwner } from '@volley-time/core'

/** Смена роли — только владелец; роль валидируется (без owner). Task 4.9.1. */
export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const memberId = Number(getRouterParam(event, 'memberId'))
  const target = await memberService.getById(ctx, memberId)
  if (target.organizationId !== event.context.organization!.id) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }
  const { role } = ChangeMemberRoleInput.parse(await readBody(event))
  const updated = await memberService.changeRole(ctx, memberId, role)
  return { member: updated }
})
