import { auditService, requireCanManageContent } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const query = getQuery(event)
  const entries = await auditService.listByOrg(ctx, event.context.organization!.id, {
    action: query.action ? String(query.action) : undefined,
    entityType: query.entityType ? String(query.entityType) : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  })
  return { entries }
})
