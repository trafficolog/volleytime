import { bookingService, requireOrgMember } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const eventId = Number(getRouterParam(event, 'eventId'))
  const body = await readBody(event)
  const booking = await withNotifications((notifications) =>
    bookingService.book({ ...ctx, notifications }, event.context.organization!.id, eventId, body),
  )
  return { booking }
})
