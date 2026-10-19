import {
  bookingService,
  canManageContent,
  eventInviteRequestService,
  eventService,
  readBookingAvailability,
  readEventPricing,
  readManualClose,
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
  // Маршрут только для участников группы (requireOrgMember): уровни видны только им (решение 2026-10-14).
  const roster = await bookingService.publicRoster(ctx, orgId, ev.id, { includeLevel: true })
  const pricing = await readEventPricing(ctx, ev.id)
  const managerPricing = canManageContent(event.context.member ?? null)
    ? {
        pricingFinancials: await readPricingFinancials(ctx, ev.id),
        pricingPermissions: await readPricingPermissions(ctx, ev.id),
        // запись ведёт организатор (20.3.1): только для управляющих
        manualClose: await readManualClose(ctx, ev.id),
      }
    : {}
  // событие «по приглашению» (20.1.3): статус своего запроса для состояний Mini App (20.4.7)
  const myInviteRequest =
    ev.joinMode === 'invite' ? await eventInviteRequestService.mine(ctx, ev.id) : null
  // Свободные места (с учётом предложений и очереди) и закрытие записи решает сервер (20.4.5, ревью #156).
  const availability = await readBookingAvailability(ctx, ev)
  return {
    event: { ...ev, ...stats, ...availability, pricing, ...managerPricing, myInviteRequest },
    roster,
    // Время сервера для отсчёта предложения места: часы телефона могут уходить (M2, ревью #156).
    serverNow: new Date().toISOString(),
  }
})
