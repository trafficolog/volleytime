import {
  and,
  bookings,
  eq,
  events,
  inArray,
  isNull,
  notInArray,
  organizations,
  payments,
  sql,
  subscriptions,
} from '@volley-time/db'
import {
  attendanceRatePercent,
  defaultPlayerStatsDates,
  resolveReportPeriod,
  safeTimezone,
  type PlayerStats,
  type PlayersStatsPeriod,
} from '@volley-time/shared'

import { reportsService } from '../reports/service'
import { getDb, type ServiceContext } from '../shared/context'
import { usableSubscriptionWhere } from '../subscriptions/predicates'

/** События, которые не считаются: черновик не виден игрокам, отменённое не состоялось (как в отчётах). */
const EXCLUDED_EVENT_STATUSES = ['draft', 'cancelled'] as const

/** Записи, за которые игрок может быть должен: не отменённые (у отменённых pending-платежи сняты). */
const DEBT_BOOKING_STATUSES = ['pending_payment', 'confirmed', 'attended', 'no_show'] as const

export interface PlayersStatsResult {
  timezone: string
  currency: string
  /** Период посещаемости (локальные даты группы, включительно). */
  period: PlayersStatsPeriod
  byUser: Map<number, PlayerStats>
}

/**
 * Агрегаты игроков для списка и карточки кабинета (W-06, 21.2.20). Посещаемость берётся из
 * `reportsService.getPlayerAttendance` (отчёты 21.2.7) — второго расчёта нет; абонемент — по
 * тому же условию «действующий», что обзор и списание занятий; долг — живые `pending`-платежи
 * мест (то, что касса показывает как «ждут оплаты»). Пакетно: три запроса на любое число
 * игроков. Вызывающий отвечает за проверку роли (`canManageContent`) и принадлежность `orgId`
 * tenant'у: игрок и управляющий другой группы эти данные получать не должны.
 */
export const playerStatsService = {
  async getForUsers(
    ctx: ServiceContext,
    orgId: number,
    userIds: number[],
    opts: { dates?: PlayersStatsPeriod; now?: Date } = {},
  ): Promise<PlayersStatsResult> {
    const db = getDb(ctx)
    const now = opts.now ?? new Date()
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { defaultCurrency: true, defaultTimezone: true },
    })
    const currency = org?.defaultCurrency ?? 'BYN'
    const timezone = safeTimezone(org?.defaultTimezone)
    const dates = opts.dates ?? defaultPlayerStatsDates(now, timezone)
    const period = resolveReportPeriod(dates.from, dates.to, timezone)
    if (!period) throw new Error(`players stats: invalid period ${dates.from}..${dates.to}`)

    const ids = [...new Set(userIds)]
    const byUser = new Map<number, PlayerStats>()
    for (const id of ids) {
      byUser.set(id, {
        attendance: {
          visits: 0,
          noShows: 0,
          cancellations: 0,
          ratePercent: null,
          lastVisitAt: null,
        },
        subscription: null,
        debt: { amount: 0, seats: 0, currency },
      })
    }
    if (ids.length === 0) return { timezone, currency, period: dates, byUser }

    const [attendance, subs, debts] = await Promise.all([
      reportsService.getPlayerAttendance(ctx, orgId, period, { userIds: ids }),
      db
        .select({
          userId: subscriptions.userId,
          remaining: sql<number>`sum(${subscriptions.totalSessions} - ${subscriptions.usedSessions})::int`,
          total: sql<number>`sum(${subscriptions.totalSessions})::int`,
          expiresAt: sql<Date | null>`min(${subscriptions.expiresAt})`,
          count: sql<number>`count(*)::int`,
        })
        .from(subscriptions)
        .where(and(usableSubscriptionWhere(orgId, now), inArray(subscriptions.userId, ids)))
        .groupBy(subscriptions.userId),
      db
        .select({
          userId: bookings.userId,
          amount: sql<number>`sum(${payments.amount})::int`,
          seats: sql<number>`count(*)::int`,
        })
        .from(payments)
        .innerJoin(
          bookings,
          and(
            eq(bookings.id, payments.bookingId),
            eq(payments.bookingIncarnation, bookings.incarnation),
          ),
        )
        .innerJoin(events, eq(events.id, bookings.eventId))
        .where(
          and(
            eq(payments.organizationId, orgId),
            eq(bookings.organizationId, orgId),
            eq(events.organizationId, orgId),
            eq(payments.status, 'pending'),
            isNull(payments.seatReleasedAt),
            eq(payments.currency, currency),
            inArray(bookings.status, [...DEBT_BOOKING_STATUSES]),
            notInArray(events.status, [...EXCLUDED_EVENT_STATUSES]),
            inArray(bookings.userId, ids),
          ),
        )
        .groupBy(bookings.userId),
    ])

    for (const a of attendance) {
      const stats = byUser.get(a.userId)
      if (!stats) continue
      stats.attendance = {
        visits: a.visits,
        noShows: a.noShows,
        cancellations: a.cancellations,
        ratePercent: attendanceRatePercent(a.visits, a.noShows),
        lastVisitAt: a.lastVisitAt,
      }
    }
    for (const s of subs) {
      const stats = byUser.get(s.userId)
      if (!stats) continue
      stats.subscription = {
        remaining: s.remaining,
        total: s.total,
        // агрегат sql<Date> возвращается драйвером строкой; нормализуем в ISO
        expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : null,
        count: s.count,
      }
    }
    for (const d of debts) {
      const stats = byUser.get(d.userId)
      if (stats) stats.debt = { amount: d.amount, seats: d.seats, currency }
    }
    return { timezone, currency, period: dates, byUser }
  },
}
