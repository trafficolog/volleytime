import {
  bookingService,
  canManageContent,
  eventService,
  ledgerService,
  paymentService,
  readEventPricing,
  requireOrgMember,
  subscriptionService,
} from '@volley-time/core'

/** Данные дашборда группы: игроку — ближайшие записи и абонемент, управляющему — деньги и события (8.8.12). */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const orgId = event.context.organization!.id
  const isManager = canManageContent(event.context.member ?? null)

  const [myBookings, myCounts, mySubs, upcoming] = await Promise.all([
    bookingService.listMyBookings(ctx, orgId, 'upcoming', { limit: 10, excludeCancelled: true }),
    bookingService.countMyUpcoming(ctx, orgId),
    subscriptionService.listMine(ctx, orgId),
    eventService.list(
      ctx,
      orgId,
      { filter: 'upcoming', limit: 5, ...(!isManager && { status: 'published' as const }) },
      { includeDrafts: isManager },
    ),
  ])
  // Hero главной игрока (20.4.4): ближайшая игра, на которую я иду (не лист ожидания), даже если
  // она вне первых пяти опубликованных или запись уже закрыта, а доля ждёт оплаты.
  const goingBooking = isManager
    ? undefined
    : myBookings.find(
        (b) =>
          (b.status === 'confirmed' || b.status === 'pending_payment') &&
          b.event.status !== 'cancelled' &&
          b.event.status !== 'draft',
      )
  const stats = await eventService.statsFor(ctx, [
    ...new Set([...upcoming.map((e) => e.id), ...(goingBooking ? [goingBooking.eventId] : [])]),
  ])

  const activeSub = mySubs.find(
    (s) =>
      s.status === 'active' &&
      s.usedSessions < s.totalSessions &&
      (!s.expiresAt || new Date(s.expiresAt) > new Date()),
  )

  const manager = isManager
    ? await (async () => {
        const [pending, balance] = await Promise.all([
          paymentService.listPending(ctx, orgId),
          ledgerService.getBalance(ctx, orgId),
        ])
        const pendingAmount = pending
          .filter((p) => p.currency === balance.currency)
          .reduce((a, p) => a + p.amount, 0)
        return { pendingCount: pending.length, pendingAmount, balance }
      })()
    : null

  return {
    isManager,
    // точные счётчики только своих записей для плитки «Мои записи» (20.4.4)
    bookingsCount: myCounts.total,
    bookingsAwaitingPayment: myCounts.awaitingPayment,
    myBookings: await Promise.all(
      myBookings.slice(0, 3).map(async (b) => ({
        id: b.id,
        status: b.status,
        pricing: await readEventPricing(ctx, b.eventId),
        event: {
          id: b.event.id,
          title: b.event.title,
          startsAt: b.event.startsAt,
          currency: b.event.currency,
          venue: b.event.venue ? { name: b.event.venue.name } : null,
        },
      })),
    ),
    hero: goingBooking
      ? {
          ...goingBooking.event,
          // stats переопределяет связь `venue` (name + address) — как в `upcoming`
          ...stats.get(goingBooking.eventId)!,
          pricing: await readEventPricing(ctx, goingBooking.eventId),
        }
      : null,
    subscription: activeSub
      ? {
          id: activeSub.id,
          left: activeSub.totalSessions - activeSub.usedSessions,
          total: activeSub.totalSessions,
          expiresAt: activeSub.expiresAt,
        }
      : null,
    upcoming: await Promise.all(
      upcoming.map(async (e) => ({
        ...e,
        ...stats.get(e.id)!,
        pricing: await readEventPricing(ctx, e.id),
      })),
    ),
    manager,
  }
})
