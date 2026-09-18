import { inviteService, requireCanInvite } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanInvite(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const invites = await inviteService.listByOrg(ctx, event.context.organization!.id)
  const enriched = invites.map((inv) => ({ ...inv, deeplinkUrl: inviteDeeplink(inv.token) }))
  return { invites: enriched }
})
