import {
  and,
  bookings,
  desc,
  eq,
  events,
  gte,
  inArray,
  lt,
  notInArray,
  organizationMembers,
  organizations,
  sql,
  users,
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
