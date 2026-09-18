import { planService, requireOrgMember } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const plans = await planService.listByOrg(ctx, event.context.organization!.id)
  return { plans }
})
