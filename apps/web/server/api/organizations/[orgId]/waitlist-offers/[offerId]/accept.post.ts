import { bookingService, requireOrgMember } from '@volley-time/core'

/**
 * Принять предложение места из листа ожидания (20.3.1, D-03): только сам игрок, пока предложение
 * активно (30 мин). Чужое или из другой группы — 404, истёкшее — 410 `waitlist_offer.expired`.
 */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const offerId = Number(getRouterParam(event, 'offerId'))
  if (!Number.isInteger(offerId) || offerId <= 0) {
    throw createError({ statusCode: 404, statusMessage: 'Waitlist offer not found' })
  }
  const booking = await withNotifications((notifications) =>
    bookingService.acceptWaitlistOffer({ ...ctx, notifications }, offerId, {
      organizationId: event.context.organization!.id,
    }),
  )
  return { booking }
})
