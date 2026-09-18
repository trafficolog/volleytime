import { eventService, requireCanManageContent } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const body = await readBody(event)
  const created = await eventService.create(ctx, event.context.organization!.id, body)
  return { event: created }
})
