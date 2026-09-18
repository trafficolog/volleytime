import { organizationService, requireOrgOwner } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const body = await readBody(event)
  const updated = await organizationService.update(ctx, event.context.organization!.id, body)
  return { organization: updated }
})
