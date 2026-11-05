import { canManageContent, requireOrgMember, venueService } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  const member = event.context.member ?? null
  requireOrgMember(member)
  const ctx = createServiceContextFromEvent(event)
  // архивные залы (21.2.13) видит только управляющий; в выборе зала для события их нет
  const includeArchived = getQuery(event).includeArchived === 'true' && canManageContent(member)
  const venues = await venueService.listByOrg(ctx, event.context.organization!.id, includeArchived)
  return { venues }
})
