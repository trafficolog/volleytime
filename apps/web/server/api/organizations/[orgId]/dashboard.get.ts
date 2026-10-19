import {
  bookingService,
  canManageContent,
  eventService,
  ledgerService,
  EventNotFoundError,
  paymentService,
  readEventPriceQuote,
  readEventPricing,
  requireOrgMember,
  SeatsOverLimitError,
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

  /**
   * Цена split для игрока — тот же расчёт, что и `GET …/events/{id}/price` (`quoteEventPrice`, 20.1.1,
   * D-01 (B)): hero и расписание Главной показывают её, а не `readEventPricing` (20.4.6). Управляющему
   * и fixed-событиям не нужна; недоступный расчёт (места игрока выше нового лимита группы) — без цены.
   */
  async function quoteFor(eventId: number, mode: string) {
    if (isManager || mode !== 'split') return null
    try {
      return await readEventPriceQuote(ctx, {
        organizationId: orgId,
        eventId,
        includeDrafts: false,
      })
    } catch (error) {
      if (error instanceof SeatsOverLimitError || error instanceof EventNotFoundError) return null
      throw error
    }
  }

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
      ? await (async () => {
          const pricing = await readEventPricing(ctx, goingBooking.eventId)
          return {
            ...goingBooking.event,
            // stats переопределяет связь `venue` (name + address) — как в `upcoming`
            ...stats.get(goingBooking.eventId)!,
            pricing,
            priceQuote: await quoteFor(goingBooking.eventId, pricing.mode),
          }
        })()
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
      upcoming.map(async (e) => {
        const pricing = await readEventPricing(ctx, e.id)
        return {
          ...e,
          ...stats.get(e.id)!,
          pricing,
          priceQuote: await quoteFor(e.id, pricing.mode),
        }
      }),
    ),
    manager,
  }
})
