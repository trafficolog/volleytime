import { bookingService, requireCanManageContent } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const eventId = Number(getRouterParam(event, 'eventId'))
  const bookings = await bookingService.listByEvent(ctx, event.context.organization!.id, eventId)
  return { bookings }
})
