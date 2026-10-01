import { eventPricingService, requireCanManageContent } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const eventId = Number(getRouterParam(event, 'eventId'))
  return withNotifications((notifications) =>
    eventPricingService.settle({ ...ctx, notifications }, event.context.organization!.id, eventId),
  )
})
