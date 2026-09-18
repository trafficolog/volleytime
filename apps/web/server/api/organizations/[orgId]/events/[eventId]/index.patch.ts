import { eventService, requireCanManageContent } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const eventId = Number(getRouterParam(event, 'eventId'))
  const ev = await eventService.getById(ctx, eventId)
  if (ev.organizationId !== event.context.organization!.id) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  const body = await readBody(event)
  const updated = await eventService.update(ctx, eventId, body)
  return { event: updated }
})
