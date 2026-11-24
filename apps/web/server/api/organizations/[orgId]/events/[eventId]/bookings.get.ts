import {
  bookingService,
  canSeeEventPayments,
  eventService,
  requireCanCoachEvent,
  toCoachRosterRow,
} from '@volley-time/core'

/**
 * Состав события с записями. Управляющие — полностью; тренер события (30.1.1, P-18: роль в группе
 * ∪ роль на событии) — тот же состав, суммы и статусы оплаты — только с флагом `canAcceptPayment`.
 */
export default defineApiHandler(async (event) => {
  const member = event.context.member ?? null
  const ctx = createServiceContextFromEvent(event)
  const orgId = event.context.organization!.id
  const eventId = Number(getRouterParam(event, 'eventId'))
  const ev = await eventService.getById(ctx, eventId)
  if (ev.organizationId !== orgId) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  requireCanCoachEvent(member, ev)
  const bookings = await bookingService.listByEvent(ctx, orgId, eventId)
  if (canSeeEventPayments(member, ev)) return { bookings }
  return { bookings: bookings.map(toCoachRosterRow) }
})
