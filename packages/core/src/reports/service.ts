import {
  and,
  bookings,
  desc,
  eq,
  eventSeries,
  events,
  gte,
  inArray,
  ledgerEntries,
  lt,
  notInArray,
  organizationMembers,
  organizations,
  payments,
  sql,
  users,
  venues,
} from '@volley-time/db'
import {
  REPORT_EXPORT_COLUMNS,
  formatShortDate,
  formatTime,
  previousReportDates,
  reportBuckets,
  reportGranularity,
  resolveReportPeriod,
  safeTimezone,
  type ManagerReport,
  type ReportBreakdown,
  type ReportBreakdownDimension,
  type ReportBreakdownFigures,
  type ReportBreakdownRow,
  type ReportExportType,
  type ReportOccupancy,
  type ReportPeriod,
  type ReportPlayerAttendance,
} from '@volley-time/shared'

import { OCCUPYING_STATUSES } from '../bookings/seats'
import {
  csvCell,
  formatCsvAmount,
  ledgerCategoryLabel,
  ledgerMethodLabel,
  personLabel,
} from '../ledger/csv'
import { EXPORT_MAX_ROWS, ledgerService, type LedgerHistoryEntry } from '../ledger/service'
import { levelService } from '../levels/service'
import { getDb, type ServiceContext } from '../shared/context'

/** Строк в рейтинге «Самые активные» отчёта (полный список — в выгрузке посещаемости). */
export const REPORT_TOP_PLAYERS = 10

/** События, которые не считаются в отчётах: черновик не виден игрокам, отменённое не состоялось. */
const EXCLUDED_EVENT_STATUSES = ['draft', 'cancelled'] as const

/** Выгрузка не помещается в `EXPORT_MAX_ROWS`: кабинет просит сузить период. */
export class ReportExportTooLargeError extends Error {
  code = 'reports.export_too_large'
  override name = 'ReportExportTooLargeError'
  constructor() {
    super(`В выгрузке больше ${EXPORT_MAX_ROWS} строк: сузьте период`)
  }
}

export interface ReportExportData {
  type: ReportExportType
  columns: { key: string; label: string }[]
  /** Все строки выгрузки, ячейки уже в виде текста. */
  rows: string[][]
  csv: string
}

const eventsInPeriod = (orgId: number, period: ReportPeriod) =>
  and(
    eq(events.organizationId, orgId),
    gte(events.startsAt, period.from),
    lt(events.startsAt, period.to),
    notInArray(events.status, [...EXCLUDED_EVENT_STATUSES]),
  )

/**
 * Отчёты кабинета управляющего (W-10, 21.2.7). Читает только существующие таблицы; деньги —
 * из `ledgerService` (те же `getPeriodTotals`, что у кассы и обзора), заполняемость — по тем же
 * правилам, что обзор (события месяца без черновиков и отмен, занятые места по `OCCUPYING_STATUSES`).
 * Агрегаты посещаемости по игрокам (`getPlayerAttendance`) — общий источник для списка игроков
 * (21.2.20). Вызывающий отвечает за проверку роли (`canManageContent`) и принадлежность `orgId`
 * tenant'у; границы периода — полуинтервал в зоне группы.
 */
export const reportsService = {
  async getManagerReport(
    ctx: ServiceContext,
    orgId: number,
    dates: { from: string; to: string },
  ): Promise<ManagerReport> {
    const org = await getDb(ctx).query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { defaultCurrency: true, defaultTimezone: true },
    })
    const currency = org?.defaultCurrency ?? 'BYN'
    const timezone = safeTimezone(org?.defaultTimezone)
    const period = requirePeriod(dates, timezone)
    const previousDates = previousReportDates(dates.from, dates.to)
    const previousPeriod = requirePeriod(previousDates, timezone)
    const buckets = reportBuckets(dates.from, dates.to, timezone)

    const [totals, bucketTotals, categories, occupancy, previousOccupancy, attendance] =
      await Promise.all([
        ledgerService.getPeriodTotals(ctx, orgId, period),
        Promise.all(buckets.map((b) => ledgerService.getPeriodTotals(ctx, orgId, b))),
        ledgerService.getExpenseByCategory(ctx, orgId, period),
        this.getOccupancy(ctx, orgId, period),
        this.getOccupancy(ctx, orgId, previousPeriod),
        this.getPlayerAttendance(ctx, orgId, period),
      ])

    return {
      timezone,
      currency,
      period: dates,
      previous: previousDates,
      money: {
        income: totals.income,
        expense: totals.expense,
        net: totals.income - totals.expense,
        granularity: reportGranularity(dates.from, dates.to),
        buckets: buckets.map((b, i) => ({
          from: b.from.toISOString(),
          to: b.to.toISOString(),
          fromDate: b.fromDate,
          toDate: b.toDate,
          income: bucketTotals[i]!.income,
          expense: bucketTotals[i]!.expense,
          net: bucketTotals[i]!.income - bucketTotals[i]!.expense,
        })),
        expenseByCategory: categories,
      },
      occupancy: { ...occupancy, previous: previousOccupancy },
      attendance: {
        visits: attendance.reduce((a, p) => a + p.visits, 0),
        noShows: attendance.reduce((a, p) => a + p.noShows, 0),
        cancellations: attendance.reduce((a, p) => a + p.cancellations, 0),
        top: attendance.filter((p) => p.visits > 0).slice(0, REPORT_TOP_PLAYERS),
      },
    }
  },

  /**
   * «В разрезе» (W-19, 30.3.4): игры, заполняемость, выручка и аренда по тренерам, залам или
   * сериям. Деньги — записи кассы периода по дате операции в валюте группы (как `getPeriodTotals`):
   * поступления и расход «Аренда», отнесённые к событию записью кассы или оплатой записи; то, что
   * к событию не привязано или у события нет тренера/зала/серии, идёт в строку «Не указано», поэтому
   * `income` и `rent` строк в сумме равны кассе. Игры и места — события периода (как заполняемость
   * отчёта). Событие с несколькими тренерами считается в игры каждого, а деньги делятся между ними
   * поровну в минорных единицах (остаток — тренерам с меньшим id), итог считает событие один раз.
   */
  async getBreakdown(
    ctx: ServiceContext,
    orgId: number,
    input: { dimension: ReportBreakdownDimension; from: string; to: string },
  ): Promise<ReportBreakdown> {
    const db = getDb(ctx)
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { defaultCurrency: true, defaultTimezone: true },
    })
    const currency = org?.defaultCurrency ?? 'BYN'
    const period = requirePeriod(input, safeTimezone(org?.defaultTimezone))
    const { dimension } = input

    const resolvedEventId = sql<
      number | null
    >`COALESCE(${ledgerEntries.eventId}, ${bookings.eventId})`
    const income = sql<number>`COALESCE(SUM(${ledgerEntries.amount}) FILTER (WHERE ${ledgerEntries.type} = 'income'), 0)::int`
    const rent = sql<number>`COALESCE(SUM(${ledgerEntries.amount}) FILTER (WHERE ${ledgerEntries.type} = 'expense'), 0)::int`
    const [periodEvents, seatRows, moneyRows] = await Promise.all([
      db
        .select({
          id: events.id,
          venueId: events.venueId,
          seriesId: events.seriesId,
          coachUserIds: events.coachUserIds,
          capacity: events.capacity,
        })
        .from(events)
        .where(eventsInPeriod(orgId, period)),
      db
        .select({
          eventId: bookings.eventId,
          seats: sql<number>`coalesce(sum(${bookings.seats}), 0)::int`,
        })
        .from(bookings)
        .innerJoin(events, eq(events.id, bookings.eventId))
        .where(
          and(eventsInPeriod(orgId, period), inArray(bookings.status, [...OCCUPYING_STATUSES])),
        )
        .groupBy(bookings.eventId),
      db
        .select({ eventId: resolvedEventId, income, rent })
        .from(ledgerEntries)
        .leftJoin(payments, eq(payments.id, ledgerEntries.paymentId))
        .leftJoin(bookings, eq(bookings.id, payments.bookingId))
        .where(
          and(
            eq(ledgerEntries.organizationId, orgId),
            eq(ledgerEntries.currency, currency),
            gte(ledgerEntries.occurredAt, period.from),
            lt(ledgerEntries.occurredAt, period.to),
            sql`(${ledgerEntries.type} = 'income' OR (${ledgerEntries.type} = 'expense' AND ${ledgerEntries.category} = 'rent'))`,
          ),
        )
        .groupBy(resolvedEventId),
    ])

    // деньги события могут лежать вне периода (оплата внесена в этот период): берём его разрез
    const dims = new Map<number, EventDims>(periodEvents.map((e) => [e.id, e]))
    const moneyEventIds = moneyRows.flatMap((m) => (m.eventId !== null ? [m.eventId] : []))
    if (moneyEventIds.length > 0) {
      const rows = await db
        .select({
          id: events.id,
          venueId: events.venueId,
          seriesId: events.seriesId,
          coachUserIds: events.coachUserIds,
        })
        .from(events)
        .where(and(eq(events.organizationId, orgId), inArray(events.id, moneyEventIds)))
      for (const row of rows) dims.set(row.id, row)
    }

    const seatsByEvent = new Map(seatRows.map((r) => [r.eventId, r.seats]))
    const groups = new Map<number | null, BreakdownTally>()
    const tally = (key: number | null) => {
      let t = groups.get(key)
      if (!t) groups.set(key, (t = { events: 0, seats: 0, capacity: 0, income: 0, rent: 0 }))
      return t
    }
    const totals: BreakdownTally = { events: 0, seats: 0, capacity: 0, income: 0, rent: 0 }

    for (const e of periodEvents) {
      const seats = seatsByEvent.get(e.id) ?? 0
      totals.events += 1
      totals.seats += seats
      totals.capacity += e.capacity
      for (const key of breakdownKeys(dimension, e)) {
        const t = tally(key)
        t.events += 1
        t.seats += seats
        t.capacity += e.capacity
      }
    }
    for (const m of moneyRows) {
      totals.income += m.income
      totals.rent += m.rent
      const keys = breakdownKeys(dimension, m.eventId !== null ? dims.get(m.eventId) : undefined)
      const incomeShares = splitMinor(m.income, keys.length)
      const rentShares = splitMinor(m.rent, keys.length)
      keys.forEach((key, i) => {
        const t = tally(key)
        t.income += incomeShares[i]!
        t.rent += rentShares[i]!
      })
    }

    const labels = await breakdownLabels(ctx, orgId, dimension, [...groups.keys()])
    const rows: ReportBreakdownRow[] = [...groups.entries()]
      .map(([key, t]) => ({
        key,
        label: key === null ? null : (labels.get(key) ?? null),
        ...figures(t),
      }))
      .sort(compareBreakdownRows)

    return {
      dimension,
      currency,
      period: { from: input.from, to: input.to },
      rows,
      totals: figures(totals),
    }
  },

  /** Заполняемость событий периода: занятые места / вместимость (как `overview.bookings`). */
  async getOccupancy(
    ctx: ServiceContext,
    orgId: number,
    period: ReportPeriod,
  ): Promise<ReportOccupancy> {
    const db = getDb(ctx)
    const [eventRow, seatRow] = await Promise.all([
      db
        .select({
          count: sql<number>`count(*)::int`,
          capacity: sql<number>`coalesce(sum(${events.capacity}), 0)::int`,
        })
        .from(events)
        .where(eventsInPeriod(orgId, period)),
      db
        .select({ seats: sql<number>`coalesce(sum(${bookings.seats}), 0)::int` })
        .from(bookings)
        .innerJoin(events, eq(events.id, bookings.eventId))
        .where(
          and(eventsInPeriod(orgId, period), inArray(bookings.status, [...OCCUPYING_STATUSES])),
        ),
    ])
    const capacity = eventRow[0]?.capacity ?? 0
    const seats = seatRow[0]?.seats ?? 0
    return {
      events: eventRow[0]?.count ?? 0,
      seats,
      capacity,
      percent: capacity > 0 ? Math.round((seats / capacity) * 100) : null,
    }
  },

  /**
   * Посещаемость игроков группы за период: пришёл / не пришёл / отменил по записям на события
   * периода (черновики и отменённые события не считаются). Одна пакетная выборка без N+1;
   * `userIds` сужает её до нужных игроков (список игроков 21.2.20). Игроки без записей периода
   * в результат не попадают. Порядок: больше визитов, затем больше мест, затем меньший id.
   */
  async getPlayerAttendance(
    ctx: ServiceContext,
    orgId: number,
    period: ReportPeriod,
    opts: { userIds?: number[] } = {},
  ): Promise<ReportPlayerAttendance[]> {
    if (opts.userIds && opts.userIds.length === 0) return []
    const attended = sql`${bookings.status} = 'attended'`
    const visits = sql<number>`count(*) FILTER (WHERE ${attended})::int`
    const seats = sql<number>`coalesce(sum(${bookings.seats}) FILTER (WHERE ${attended}), 0)::int`
    const rows = await getDb(ctx)
      .select({
        userId: users.id,
        name: users.name,
        telegramUsername: users.telegramUsername,
        level: organizationMembers.level,
        visits,
        seats,
        noShows: sql<number>`count(*) FILTER (WHERE ${bookings.status} = 'no_show')::int`,
        cancellations: sql<number>`count(*) FILTER (WHERE ${bookings.status} = 'cancelled')::int`,
        lastVisitAt: sql<Date | null>`max(${events.startsAt}) FILTER (WHERE ${attended})`,
      })
      .from(bookings)
      .innerJoin(events, eq(events.id, bookings.eventId))
      .innerJoin(users, eq(users.id, bookings.userId))
      .leftJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, bookings.userId),
        ),
      )
      .where(
        and(
          eventsInPeriod(orgId, period),
          eq(bookings.organizationId, orgId),
          inArray(bookings.status, ['attended', 'no_show', 'cancelled']),
          ...(opts.userIds ? [inArray(bookings.userId, opts.userIds)] : []),
        ),
      )
      .groupBy(users.id, users.name, users.telegramUsername, organizationMembers.level)
      .orderBy(desc(visits), desc(seats), users.id)
    return rows.map((r) => ({
      ...r,
      level: r.level ?? null,
      // агрегат sql<Date> возвращается драйвером строкой; нормализуем в ISO
      lastVisitAt: r.lastVisitAt ? new Date(r.lastVisitAt).toISOString() : null,
    }))
  },

  /**
   * Строки и CSV выгрузки отчёта за период. Финансовый — записи кассы периода (тот же отбор и
   * подписи, что у CSV кассы), посещаемость — по игрокам. `columns` — подмножество колонок типа в
   * порядке макета; без него — колонки по умолчанию. Больше `EXPORT_MAX_ROWS` строк —
   * `ReportExportTooLargeError`.
   */
  async buildExport(
    ctx: ServiceContext,
    orgId: number,
    input: { type: ReportExportType; from: string; to: string; columns?: string[] },
  ): Promise<ReportExportData> {
    const org = await getDb(ctx).query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { defaultTimezone: true },
    })
    const timezone = safeTimezone(org?.defaultTimezone)
    const period = requirePeriod(input, timezone)
    const all = REPORT_EXPORT_COLUMNS[input.type]
    const selected = all.filter((c) => (input.columns ? input.columns.includes(c.key) : c.default))

    let records: Record<string, string>[]
    if (input.type === 'finance') {
      const entries = await ledgerService.listForExport(ctx, orgId, period)
      if (entries.length > EXPORT_MAX_ROWS) throw new ReportExportTooLargeError()
      records = entries.map((e) => financeRecord(e, timezone))
    } else {
      const [players, levels] = await Promise.all([
        this.getPlayerAttendance(ctx, orgId, period),
        levelService.list(ctx),
      ])
      const levelTitles = new Map<string, string>(levels.map((l) => [l.code, l.title]))
      records = players.map((p) => attendanceRecord(p, timezone, levelTitles))
    }

    const rows = records.map((r) => selected.map((c) => r[c.key] ?? ''))
    const header = selected.map((c) => csvCell(c.label)).join(';')
    const body = rows.map((cells) => cells.map((c) => csvCell(c)).join(';'))
    return {
      type: input.type,
      columns: selected.map(({ key, label }) => ({ key, label })),
      rows,
      csv: `\uFEFF${[header, ...body].join('\r\n')}\r\n`,
    }
  },
}

function requirePeriod(dates: { from: string; to: string }, timezone: string): ReportPeriod {
  const period = resolveReportPeriod(dates.from, dates.to, timezone)
  if (!period) throw new Error(`reports: invalid period ${dates.from}..${dates.to}`)
  return period
}

function financeRecord(e: LedgerHistoryEntry, timezone: string): Record<string, string> {
  return {
    date: `${formatShortDate(e.occurredAt, timezone)} ${formatTime(e.occurredAt, timezone)}`,
    type: e.type === 'income' ? 'Поступление' : 'Расход',
    category: ledgerCategoryLabel(e.category),
    description: e.description ?? '',
    event: e.event?.title ?? '',
    method: e.method ? ledgerMethodLabel(e.method) : '',
    amount: formatCsvAmount(e.amount),
    currency: e.currency,
    payer: personLabel(e.payer),
    author: personLabel(e.author),
  }
}

function attendanceRecord(
  p: ReportPlayerAttendance,
  timezone: string,
  levelTitles: Map<string, string>,
): Record<string, string> {
  return {
    player: personLabel(p),
    visits: String(p.visits),
    seats: String(p.seats),
    noShows: String(p.noShows),
    cancellations: String(p.cancellations),
    lastVisit: p.lastVisitAt ? formatShortDate(p.lastVisitAt, timezone) : '',
    level: p.level ? (levelTitles.get(p.level) ?? p.level) : '',
  }
}

interface BreakdownTally {
  events: number
  seats: number
  capacity: number
  income: number
  rent: number
}

interface EventDims {
  venueId: number | null
  seriesId: number | null
  coachUserIds: number[]
}

/** Ключи строк разреза для события; `null` — «Не указано» (нет события, зала, серии или тренера). */
function breakdownKeys(
  dimension: ReportBreakdownDimension,
  event: EventDims | undefined,
): (number | null)[] {
  if (!event) return [null]
  if (dimension === 'venue') return [event.venueId]
  if (dimension === 'series') return [event.seriesId]
  const coaches = [...new Set(event.coachUserIds)].sort((a, b) => a - b)
  return coaches.length > 0 ? coaches : [null]
}

/** Делит минорные единицы поровну на `parts` без потери копейки: остаток — первым долям. */
function splitMinor(amount: number, parts: number): number[] {
  const base = Math.floor(amount / parts)
  const rest = amount - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0))
}

function figures(t: BreakdownTally): ReportBreakdownFigures {
  return {
    ...t,
    percent: t.capacity > 0 ? Math.round((t.seats / t.capacity) * 100) : null,
  }
}

/** Больше выручка — выше; при равенстве больше игр, затем название; «Не указано» — последним. */
function compareBreakdownRows(a: ReportBreakdownRow, b: ReportBreakdownRow): number {
  if ((a.key === null) !== (b.key === null)) return a.key === null ? 1 : -1
  return (
    b.income - a.income ||
    b.events - a.events ||
    (a.label ?? '').localeCompare(b.label ?? '', 'ru') ||
    (a.key ?? 0) - (b.key ?? 0)
  )
}

/** Подписи строк разреза: имя тренера, название зала или серии (группы `orgId`). */
async function breakdownLabels(
  ctx: ServiceContext,
  orgId: number,
  dimension: ReportBreakdownDimension,
  keys: (number | null)[],
): Promise<Map<number, string>> {
  const ids = keys.filter((k): k is number => k !== null)
  const labels = new Map<number, string>()
  if (ids.length === 0) return labels
  const db = getDb(ctx)
  if (dimension === 'venue') {
    const rows = await db
      .select({ id: venues.id, name: venues.name })
      .from(venues)
      .where(and(eq(venues.organizationId, orgId), inArray(venues.id, ids)))
    for (const r of rows) labels.set(r.id, r.name)
  } else if (dimension === 'series') {
    const rows = await db
      .select({ id: eventSeries.id, title: sql<string | null>`${eventSeries.template}->>'title'` })
      .from(eventSeries)
      .where(and(eq(eventSeries.organizationId, orgId), inArray(eventSeries.id, ids)))
    for (const r of rows) if (r.title) labels.set(r.id, r.title)
  } else {
    const rows = await db
      .select({ id: users.id, name: users.name, telegramUsername: users.telegramUsername })
      .from(users)
      .where(inArray(users.id, ids))
    for (const r of rows) {
      const label = personLabel(r)
      if (label) labels.set(r.id, label)
    }
  }
  return labels
}
