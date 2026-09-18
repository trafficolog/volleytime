import { bookingService, requireCanManageContent } from '@volley-time/core'

/** Посещаемость пачкой: только брони этого события этой организации (5.13.4). */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const eventId = Number(getRouterParam(event, 'eventId'))
  const body = await readBody<{ marks?: unknown }>(event)
  const count = await bookingService.bulkAttendance(
    ctx,
    event.context.organization!.id,
    eventId,
    (body?.marks ?? []) as never,
  )
  return { marked: count }
})
