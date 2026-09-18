import { inviteService, requireCanInvite } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanInvite(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const inviteId = Number(getRouterParam(event, 'inviteId'))
  await inviteService.revoke(ctx, event.context.organization!.id, inviteId)
  return { success: true }
})
