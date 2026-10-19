import {
  bookingService,
  canManageContent,
  eventInviteRequestService,
  eventService,
  getDb,
  isSchedulerEnabled,
  readEventPricing,
  readManualClose,
  readPricingFinancials,
  readPricingPermissions,
  requireOrgMember,
  reservedSeats,
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
  // Свободные места для новой записи: вместимость минус занятые и удерживаемые предложениями
  // из очереди (20.3.1) — по ним степпер Mini App решает, нужна ли очередь (20.4.5).
  // При включённом планировщике свободное место уходит очереди (предложением): пока она не пуста,
  // новому игроку свободных мест не обещаем — запись всё равно встала бы в очередь (M1, ревью #156).
  const queued = isSchedulerEnabled(process.env.SCHEDULER_ENABLED) && stats.waitlist > 0
  const freeSeats = queued
    ? 0
    : Math.max(0, ev.capacity - (await reservedSeats(getDb(ctx), ev.id)))
  return {
    event: { ...ev, ...stats, freeSeats, pricing, ...managerPricing, myInviteRequest },
    roster,
    // Время сервера для отсчёта предложения места: часы телефона могут уходить (M2, ревью #156).
    serverNow: new Date().toISOString(),
  }
})
