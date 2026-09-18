import { inviteService, requireCanInviteRole } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  const ctx = createServiceContextFromEvent(event)
  const body = (await readBody(event)) ?? {}
  requireCanInviteRole(event.context.member ?? null, body.roleToAssign ?? 'player')
  const invite = await inviteService.create(ctx, {
    ...body,
    organizationId: event.context.organization!.id,
  })
  const deeplinkUrl = inviteDeeplink(invite.token)
  return { invite, deeplinkUrl }
})
