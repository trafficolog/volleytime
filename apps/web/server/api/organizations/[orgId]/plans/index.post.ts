import { planService, requireCanManageContent } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const body = await readBody(event)
  const plan = await planService.create(ctx, {
    ...body,
    organizationId: event.context.organization!.id,
  })
  return { plan }
})
