import { bookingService, canManageContent, requireOrgMember } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const bookingId = Number(getRouterParam(event, 'bookingId'))
  const booking = await bookingService.getById(ctx, bookingId)
  if (booking.organizationId !== event.context.organization!.id) {
    throw createError({ statusCode: 404, statusMessage: 'Booking not found' })
  }
  const byAdmin = canManageContent(event.context.member ?? null)
  const result = await withNotifications((notifications) =>
    bookingService.cancel({ ...ctx, notifications }, bookingId, { byAdmin }),
  )
  return { booking: result.booking, promoted: result.promoted }
})
