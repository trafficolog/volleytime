import { requireOrgMember, venueService } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const venues = await venueService.listByOrg(ctx, event.context.organization!.id)
  return { venues }
})
