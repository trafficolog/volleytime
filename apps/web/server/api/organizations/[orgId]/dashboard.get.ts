import {
  bookingService,
  canManageContent,
  eventService,
  ledgerService,
  paymentService,
  requireOrgMember,
  subscriptionService,
} from '@volley-time/core'

/** Данные дашборда группы: игроку — ближайшие записи и абонемент, управляющему — деньги и события (8.8.12). */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const orgId = event.context.organization!.id
  const isManager = canManageContent(event.context.member ?? null)

  const [myBookings, mySubs, upcoming] = await Promise.all([
    bookingService.listMyBookings(ctx, orgId, 'upcoming', { limit: 3 }),
    subscriptionService.listMine(ctx, orgId),
    eventService.list(ctx, orgId, { filter: 'upcoming', limit: 5 }, { includeDrafts: isManager }),
  ])
  const stats = await eventService.statsFor(
    ctx,
    upcoming.map((e) => e.id),
  )

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
    myBookings: myBookings.map((b) => ({
      id: b.id,
      status: b.status,
      event: {
        id: b.event.id,
        title: b.event.title,
        startsAt: b.event.startsAt,
        venue: b.event.venue ? { name: b.event.venue.name } : null,
      },
    })),
    subscription: activeSub
      ? {
          id: activeSub.id,
          left: activeSub.totalSessions - activeSub.usedSessions,
          total: activeSub.totalSessions,
          expiresAt: activeSub.expiresAt,
        }
      : null,
    upcoming: upcoming.map((e) => ({ ...e, ...stats.get(e.id)! })),
    manager,
  }
})
