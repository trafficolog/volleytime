import {
  and,
  bookings,
  events,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  notInArray,
  organizations,
  sql,
} from '@volley-time/db'
import type { PlatformGateMetric, PlatformOverview } from '@volley-time/shared'

import { assertRootAdmin } from '../permissions/root'
import { type ServiceContext, getDb } from '../shared/context'

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS
const DAILY_DAYS = 14
const GATE_ACTIVE_DAYS = 30
const GATE_RETENTION_WEEKS = 4

/** Цели гейта Phase 10 (карточка 10.3.2): значение против цели на экране. */
const GATE_TARGETS = {
  activeOrganizers: 2,
  retention4weeks: 1,
  totalEvents: 50,
  totalBookings: 200,
} as const

/** Черновик не виден игрокам, отменённое не состоялось — как в обзоре кабинета (21.2.18). */
const EXCLUDED_EVENT_STATUSES = ['draft', 'cancelled'] as const
/** Запись — занятое место: очередь и отмены не считаются. */
const COUNTED_BOOKING_STATUSES = ['pending_payment', 'confirmed', 'attended', 'no_show'] as const

/** Группа «в обороте»: не архивная и не удалена (мягкое удаление, D-15). */
const liveOrganization = and(ne(organizations.status, 'archived'), isNull(organizations.deletedAt))
const countedEvent = and(liveOrganization, notInArray(events.status, [...EXCLUDED_EVENT_STATUSES]))

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Обзор платформы (Root Admin, 22.1.1): главная метрика, недельные счётчики и метрики гипотез
 * Phase 10. Читает только существующие таблицы. Роль root проверяется здесь же, по базе, как второй
 * рубеж после `requireRootAdmin` в API. Недели — скользящие окна по 7 суток до `now`; ряд записей —
 * сутки UTC, поэтому результат не зависит от часового пояса сервера.
 */
export const platformOverviewService = {
  async getOverview(ctx: ServiceContext, now: Date = new Date()): Promise<PlatformOverview> {
    await assertRootAdmin(ctx)
    const db = getDb(ctx)

    const thisWeekFrom = new Date(now.getTime() - WEEK_MS)
    const prevWeekFrom = new Date(now.getTime() - 2 * WEEK_MS)
    const dailyFrom = new Date(
      `${utcDay(new Date(now.getTime() - (DAILY_DAYS - 1) * DAY_MS))}T00:00:00.000Z`,
    )
    // литерал, а не параметр: GROUP BY сравнивает выражение с SELECT, а разные $n считаются разными
    const bookingWeek = sql<number>`CASE WHEN ${bookings.createdAt} >= ${sql.raw(`'${thisWeekFrom.toISOString()}'`)}::timestamptz THEN 0 ELSE 1 END`
    const bookingDay = sql<string>`to_char(${bookings.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`
    const gateActiveFrom = new Date(now.getTime() - GATE_ACTIVE_DAYS * DAY_MS)

    const [registeredRows, eventRows, bookingActivityRows, dailyRows, totals] = await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(organizations)
        .where(liveOrganization),
      // состоявшиеся события за последние 30 суток: хватает для недель, активных и ретеншна
      db
        .select({ orgId: events.organizationId, startsAt: events.startsAt })
        .from(events)
        .innerJoin(organizations, sql`${organizations.id} = ${events.organizationId}`)
        .where(and(countedEvent, gte(events.startsAt, gateActiveFrom), lt(events.startsAt, now))),
      // новые записи за две недели: группа и сутки создания
      db
        .select({
          orgId: bookings.organizationId,
          week: bookingWeek,
          n: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .innerJoin(organizations, sql`${organizations.id} = ${bookings.organizationId}`)
        .where(
          and(
            liveOrganization,
            inArray(bookings.status, [...COUNTED_BOOKING_STATUSES]),
            gte(bookings.createdAt, prevWeekFrom),
            lt(bookings.createdAt, now),
          ),
        )
        .groupBy(bookings.organizationId, bookingWeek),
      db
        .select({
          day: bookingDay,
          n: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .innerJoin(organizations, sql`${organizations.id} = ${bookings.organizationId}`)
        .where(
          and(
            liveOrganization,
            inArray(bookings.status, [...COUNTED_BOOKING_STATUSES]),
            gte(bookings.createdAt, dailyFrom),
            lt(bookings.createdAt, now),
          ),
        )
        .groupBy(bookingDay),
      Promise.all([
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(events)
          .innerJoin(organizations, sql`${organizations.id} = ${events.organizationId}`)
          .where(countedEvent),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(bookings)
          .innerJoin(organizations, sql`${organizations.id} = ${bookings.organizationId}`)
          .where(and(liveOrganization, inArray(bookings.status, [...COUNTED_BOOKING_STATUSES]))),
      ]),
    ])

    // недели и активность групп по событиям
    const activeThis = new Set<number>()
    const activePrev = new Set<number>()
    const gateActive = new Set<number>()
    const weeksByOrg = new Map<number, Set<number>>()
    let eventsThis = 0
    let eventsPrev = 0
    for (const { orgId, startsAt } of eventRows) {
      const age = now.getTime() - startsAt.getTime()
      gateActive.add(orgId)
      if (age < WEEK_MS) {
        eventsThis++
        activeThis.add(orgId)
      } else if (age < 2 * WEEK_MS) {
        eventsPrev++
        activePrev.add(orgId)
      }
      const weekIdx = Math.floor(age / WEEK_MS)
      if (weekIdx < GATE_RETENTION_WEEKS) {
        const weeks = weeksByOrg.get(orgId) ?? new Set<number>()
        weeks.add(weekIdx)
        weeksByOrg.set(orgId, weeks)
      }
    }
    let bookingsThis = 0
    let bookingsPrev = 0
    for (const { orgId, week, n } of bookingActivityRows) {
      if (Number(week) === 0) {
        bookingsThis += n
        activeThis.add(orgId)
      } else {
        bookingsPrev += n
        activePrev.add(orgId)
      }
    }

    const dailyCounts = new Map(dailyRows.map((r) => [r.day, r.n]))
    const bookingsDaily = Array.from({ length: DAILY_DAYS }, (_, i) => {
      const date = utcDay(new Date(dailyFrom.getTime() + i * DAY_MS))
      return { date, count: dailyCounts.get(date) ?? 0 }
    })

    const retention = [...weeksByOrg.values()].filter((w) => w.size === GATE_RETENTION_WEEKS).length
    const metric = (key: PlatformGateMetric['key'], value: number): PlatformGateMetric => ({
      key,
      value,
      target: GATE_TARGETS[key],
      reached: value >= GATE_TARGETS[key],
    })

    return {
      generatedAt: now.toISOString(),
      northStar: {
        activeThisWeek: activeThis.size,
        activePreviousWeek: activePrev.size,
        registered: registeredRows[0]?.n ?? 0,
      },
      week: {
        events: { current: eventsThis, previous: eventsPrev },
        bookings: { current: bookingsThis, previous: bookingsPrev },
      },
      bookingsDaily,
      gate: [
        metric('activeOrganizers', gateActive.size),
        metric('retention4weeks', retention),
        metric('totalEvents', totals[0][0]?.n ?? 0),
        metric('totalBookings', totals[1][0]?.n ?? 0),
      ],
    }
  },
}
