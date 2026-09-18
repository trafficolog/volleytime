import { requireCanManageContent, venueService } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const body = await readBody(event)
  const venue = await venueService.create(ctx, {
    ...body,
    organizationId: event.context.organization!.id,
  })
  return { venue }
})
