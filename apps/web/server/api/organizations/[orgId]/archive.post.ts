import { organizationService, requireOrgOwner } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const archived = await organizationService.archive(ctx, event.context.organization!.id)
  return { organization: archived }
})
