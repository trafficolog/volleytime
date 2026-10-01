import {
  bookingService,
  canManageContent,
  eventService,
  readEventPricing,
  readPricingFinancials,
  readPricingPermissions,
  requireOrgMember,
} from '@volley-time/core'

/** Событие + заполненность, моя бронь, площадка, публичный состав (5.13.18). */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const orgId = event.context.organization!.id
  const eventId = Number(getRouterParam(event, 'eventId'))
  const ev = await eventService.getById(ctx, eventId)
  const hidden = ev.status === 'draft' && !canManageContent(event.context.member ?? null)
  if (ev.organizationId !== orgId || hidden) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  const stats = (await eventService.statsFor(ctx, [ev.id])).get(ev.id)!
  const roster = await bookingService.publicRoster(ctx, orgId, ev.id)
  const pricing = await readEventPricing(ctx, ev.id)
  const managerPricing = canManageContent(event.context.member ?? null)
    ? {
        pricingFinancials: await readPricingFinancials(ctx, ev.id),
        pricingPermissions: await readPricingPermissions(ctx, ev.id),
      }
    : {}
  return { event: { ...ev, ...stats, pricing, ...managerPricing }, roster }
})
