import {
  and,
  bookings,
  eq,
  events,
  gte,
  inArray,
  lt,
  notInArray,
  organizations,
  sql,
  subscriptions,
} from '@volley-time/db'
import { overviewPeriods, safeTimezone, type ManagerOverview } from '@volley-time/shared'

import { OCCUPYING_STATUSES } from '../bookings/seats'
import { ledgerService } from '../ledger/service'
import { paymentService } from '../payments/service'
import { getDb, type ServiceContext } from '../shared/context'
import { usableSubscriptionWhere } from '../subscriptions/predicates'

/** События, которые не считаются в обзоре: черновик не виден игрокам, отменённое не состоялось. */
const EXCLUDED_EVENT_STATUSES = ['draft', 'cancelled'] as const

/**
 * Агрегаты обзора кабинета для управляющего (W-02, 21.2.18). Читает только существующие таблицы.
 * Вызывающий отвечает за проверку роли (`canManageContent`) и принадлежность `orgId` tenant'у.
 *
 * Касса за 4 недели берётся из `ledgerService.getPeriodTotals` — того же источника, что плитки
 * кассы кабинета: подтверждённые платежи и взносы в сборы попадают в журнал доходом, возврат —
 * расходом `refund`, поэтому ряд сходится с кассой и сборами без отдельной логики.
 */
export const overviewService = {
  async getManagerOverview(
    ctx: ServiceContext,
    orgId: number,
    now: Date = new Date(),
  ): Promise<ManagerOverview> {
    const db = getDb(ctx)
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { defaultCurrency: true, defaultTimezone: true },
    })
    const currency = org?.defaultCurrency ?? 'BYN'
    const timezone = safeTimezone(org?.defaultTimezone)
    const { month, weeks } = overviewPeriods(now, timezone)

    const monthEvents = and(
      eq(events.organizationId, orgId),
      gte(events.startsAt, month.from),
      lt(events.startsAt, month.to),
      notInArray(events.status, [...EXCLUDED_EVENT_STATUSES]),
    )

    const [eventRows, bookingRows, subscriptionRows, pending, weekTotals] = await Promise.all([
      db
        .select({
          count: sql<number>`count(*)::int`,
          capacity: sql<number>`coalesce(sum(${events.capacity}), 0)::int`,
        })
        .from(events)
        .where(monthEvents),
      db
        .select({
          count: sql<number>`count(*)::int`,
          seats: sql<number>`coalesce(sum(${bookings.seats}), 0)::int`,
        })
        .from(bookings)
        .innerJoin(events, eq(events.id, bookings.eventId))
        .where(and(monthEvents, inArray(bookings.status, [...OCCUPYING_STATUSES]))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(subscriptions)
        .where(usableSubscriptionWhere(orgId, now)),
      paymentService.listPending(ctx, orgId),
      Promise.all(weeks.map((w) => ledgerService.getPeriodTotals(ctx, orgId, w))),
    ])

    const eventsCount = eventRows[0]?.count ?? 0
    const capacity = eventRows[0]?.capacity ?? 0
    const seats = bookingRows[0]?.seats ?? 0

    const cashWeeks = weeks.map((w, i) => {
      const { income, expense } = weekTotals[i]!
      return {
        from: w.from.toISOString(),
        to: w.to.toISOString(),
        income,
        expense,
        net: income - expense,
      }
    })
    const total = cashWeeks.reduce(
      (acc, w) => ({
        income: acc.income + w.income,
        expense: acc.expense + w.expense,
        net: acc.net + w.net,
      }),
      { income: 0, expense: 0, net: 0 },
    )

    return {
      timezone,
      currency,
      month: { from: month.from.toISOString(), to: month.to.toISOString() },
      events: { thisMonth: eventsCount },
      bookings: {
        count: bookingRows[0]?.count ?? 0,
        seats,
        capacity,
        occupancyPercent: capacity > 0 ? Math.round((seats / capacity) * 100) : null,
      },
      subscriptions: { active: subscriptionRows[0]?.count ?? 0 },
      pendingPayments: {
        count: pending.length,
        amount: pending.filter((p) => p.currency === currency).reduce((a, p) => a + p.amount, 0),
        currency,
        items: pending.map((p) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          seats: p.seats,
          createdAt: p.createdAt.toISOString(),
          user: {
            id: p.user.id,
            name: p.user.name,
            telegramUsername: p.user.telegramUsername,
          },
          event: p.event
            ? { id: p.event.id, title: p.event.title, startsAt: p.event.startsAt.toISOString() }
            : null,
          plan: p.plan,
          collection: p.collection,
        })),
      },
      cashWeekly: { currency, weeks: cashWeeks, total },
    }
  },
}
