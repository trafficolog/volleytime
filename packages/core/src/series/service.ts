import {
  and,
  asc,
  eq,
  eventBalanceEntries,
  events,
  eventSeries,
  gt,
  gte,
  inArray,
  lockEventBalance,
  lt,
  ne,
  notInArray,
  organizationEventBalances,
  sql,
  type Event,
  type EventSeries,
} from '@volley-time/db'
import { expandSeriesRule, RecurrenceError, seriesOccurrence } from '@volley-time/shared'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { isEventBalanceEnforced } from '../event-balance/config'
import { EventNotFoundError, EventStartsInPastError } from '../events/errors'
import { CreateEventInput, type UpdateEventInput } from '../events/schemas'
import {
  assertVenueInOrg,
  eventService,
  insertEvent,
  readOrgEventDefaults,
  resolveEventModes,
  type OrgEventDefaults,
} from '../events/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import {
  SeriesIdempotencyConflictError,
  SeriesInvalidRuleError,
  SeriesNotFoundError,
  SeriesTooManyDatesError,
} from './errors'
import {
  CancelSeriesInput,
  CreateSeriesInput,
  UpdateSeriesInput,
  UpdateSeriesQuery,
  type SeriesTemplate,
  type CancelSeriesInput as CancelInput,
  type CreateSeriesInput as CreateInput,
  type UpdateSeriesInput as UpdateInput,
  type UpdateSeriesQuery as UpdateQuery,
} from './schemas'

export interface SeriesOccurrence {
  /** Календарная дата в часовом поясе группы. */
  date: string
  startsAt: Date
  endsAt: Date
}

export type SeriesDraftReason = 'balance' | 'venue_conflict'

export interface PlannedSeriesDate extends SeriesOccurrence {
  status: 'published' | 'draft'
  draftReason: SeriesDraftReason | null
}

/** Предпросмотр (POST …/series/preview): ничего не пишет; числа совпадают с результатом создания. */
export interface SeriesPreview {
  timezone: string
  dates: {
    date: string
    startsAt: string
    endsAt: string
    status: 'published' | 'draft'
    draftReason: SeriesDraftReason | null
  }[]
  /** Исключения, которые действительно убрали дату серии. */
  excluded: string[]
  total: number
  published: number
  drafts: number
  /** Дат-черновиков из-за занятого зала (D-04: независимо от баланса). */
  venueConflicts: number
  /** Выключатель EVENT_BALANCE_ENFORCED: выключенный публикует без списания. */
  balanceEnforced: boolean
  balanceBefore: number
  balanceAfter: number
}

export interface SeriesView {
  id: number
  rule: unknown
  exceptions: string[]
  template: unknown
  timezone: string
  status: EventSeries['status']
  createdAt: Date
  updatedAt: Date
}

export interface SeriesEventView {
  id: number
  seriesDate: string
  title: string
  startsAt: Date
  endsAt: Date
  status: Event['status']
}

export interface SeriesCreateResult {
  series: SeriesView
  events: SeriesEventView[]
  total: number
  published: number
  drafts: number
  /** null при повторе по ключу: причина черновика не хранится. */
  venueConflicts: number | null
  balanceAfter: number
  /** true — повтор запроса с тем же ключом: вернули уже созданную серию, ничего не списано. */
  replayed: boolean
}

const overlaps = (a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) =>
  a.startsAt < b.endsAt && b.startsAt < a.endsAt

/**
 * Распределить даты серии (D-04, ADR «Серии и черновики»). Дата, пересекающаяся с занятым залом
 * (`busy` — неотменённые события группы в этом зале) или с более ранней датой этой же серии, —
 * черновик независимо от баланса. Остальные по возрастанию: первые `balance` опубликованы, дальше —
 * черновики. Без списания (выключатель) публикуются все остальные.
 */
export function planSeriesDates(
  occurrences: readonly SeriesOccurrence[],
  venue: { venueId: number | null; busy: readonly { startsAt: Date; endsAt: Date }[] },
  budget: { enforced: boolean; balance: number },
): PlannedSeriesDate[] {
  const taken = [...venue.busy]
  let left = budget.balance
  return occurrences.map((o) => {
    if (venue.venueId !== null && taken.some((b) => overlaps(b, o))) {
      taken.push(o)
      return { ...o, status: 'draft' as const, draftReason: 'venue_conflict' as const }
    }
    if (venue.venueId !== null) taken.push(o)
    if (!budget.enforced) return { ...o, status: 'published' as const, draftReason: null }
    if (left > 0) {
      left -= 1
      return { ...o, status: 'published' as const, draftReason: null }
    }
    return { ...o, status: 'draft' as const, draftReason: 'balance' as const }
  })
}

type ParsedCreate = ReturnType<typeof CreateSeriesInput.parse>

/** Развернуть правило в даты и моменты начала в часовом поясе группы. */
function expand(
  data: ParsedCreate,
  timezone: string,
): { occurrences: SeriesOccurrence[]; excluded: string[] } {
  let expanded: { dates: string[]; excluded: string[] }
  try {
    expanded = expandSeriesRule(data.rule, data.exceptions)
  } catch (e) {
    if (e instanceof RecurrenceError) {
      if (e.reason === 'too_many_dates') throw new SeriesTooManyDatesError(e.message)
      throw new SeriesInvalidRuleError(e.message)
    }
    throw e
  }
  const occurrences = expanded.dates.map((date) => ({
    date,
    ...seriesOccurrence(date, data.template.startTime, data.template.durationMinutes, timezone),
  }))
  // даты по возрастанию: достаточно проверить первую (5.13.11)
  if (occurrences[0]!.startsAt <= new Date()) throw new EventStartsInPastError()
  return { occurrences, excluded: expanded.excluded }
}

/** Вход события на дату серии — через ту же схему, что и одиночное создание. */
function eventInputFor(template: SeriesTemplate, d: PlannedSeriesDate) {
  // startTime/durationMinutes заменяются моментами даты; остальные поля — как у события
  const fields = Object.entries(template).filter(
    ([k, v]) => v !== undefined && k !== 'startTime' && k !== 'durationMinutes',
  )
  return CreateEventInput.parse({
    ...Object.fromEntries(fields),
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    status: d.status,
  })
}

/**
 * Общая часть предпросмотра и создания: проверки шаблона (зал своей группы, валюта, режимы,
 * выключатели), занятость зала и распределение по балансу. Создание вызывает её под блокировкой
 * строки баланса, поэтому числа совпадают с предпросмотром на том же состоянии.
 */
async function plan(
  ctx: ServiceContext,
  orgId: number,
  data: ParsedCreate,
  org: OrgEventDefaults,
  occurrences: SeriesOccurrence[],
  balance: number,
) {
  const db = getDb(ctx)
  const venueId = data.template.venueId ?? null
  if (venueId !== null) await assertVenueInOrg(db, venueId, orgId)
  const placeholder = { ...occurrences[0]!, status: 'draft' as const, draftReason: null }
  resolveEventModes(eventInputFor(data.template, placeholder), org)

  const busy =
    venueId === null
      ? []
      : await db
          .select({ startsAt: events.startsAt, endsAt: events.endsAt })
          .from(events)
          .where(
            and(
              eq(events.organizationId, orgId),
              eq(events.venueId, venueId),
              ne(events.status, 'cancelled'),
              lt(events.startsAt, occurrences.at(-1)!.endsAt),
              gt(events.endsAt, occurrences[0]!.startsAt),
            ),
          )
  const enforced = isEventBalanceEnforced(process.env.EVENT_BALANCE_ENFORCED)
  const dates = planSeriesDates(occurrences, { venueId, busy }, { enforced, balance })
  const published = dates.filter((d) => d.status === 'published').length
  return {
    dates,
    enforced,
    published,
    drafts: dates.length - published,
    venueConflicts: dates.filter((d) => d.draftReason === 'venue_conflict').length,
    balanceAfter: enforced ? balance - published : balance,
  }
}

function seriesView(s: EventSeries): SeriesView {
  return {
    id: s.id,
    rule: s.rule,
    exceptions: s.exceptions,
    template: s.template,
    timezone: s.timezone,
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

async function eventsOf(ctx: ServiceContext, seriesId: number): Promise<SeriesEventView[]> {
  const rows = await getDb(ctx)
    .select({
      id: events.id,
      seriesDate: events.seriesDate,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      status: events.status,
    })
    .from(events)
    .where(eq(events.seriesId, seriesId))
    .orderBy(asc(events.seriesDate), asc(events.id))
  return rows.map((r) => ({ ...r, seriesDate: r.seriesDate! }))
}

/** JSON с упорядоченными ключами — сравнение запроса с сохранённой серией (jsonb меняет порядок). */
function stable(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}

const normalizeExceptions = (dates: readonly string[]) => [...new Set(dates)].sort()

/** Серия своей группы под FOR UPDATE: правки и отмены одной серии идут по очереди. */
async function lockSeries(ctx: ServiceContext, orgId: number, seriesId: number) {
  const [series] = await getDb(ctx)
    .select()
    .from(eventSeries)
    .where(and(eq(eventSeries.id, seriesId), eq(eventSeries.organizationId, orgId)))
    .for('update')
  if (!series) throw new SeriesNotFoundError(seriesId)
  return series
}

/**
 * Advisory-lock всех событий операции в детерминированном порядке `(series_date, id)` ДО любой
 * блокировки баланса: так порядок блокировок ADR (событие → баланс → платежи/абонементы) держится
 * и для нескольких событий, а две операции над пересекающимися датами не ждут друг друга по кругу.
 */
async function lockEventsInOrder(ctx: ServiceContext, rows: readonly { id: number }[]) {
  for (const row of rows) {
    await getDb(ctx).execute(sql`SELECT pg_advisory_xact_lock(${row.id})`)
  }
}

/**
 * Серии событий (20.2.2, ADR v3 «Серии и черновики», D-04). Каждая дата — обычное событие:
 * создание идёт общим путём `insertEvent` (списание — только `eventBalanceService.spendOnPublish`),
 * отмена — `eventService.cancel` (возврат по D-09/D-13, платежи по R0.7/20.1.2).
 */
export const seriesService = {
  async preview(ctx: ServiceContext, orgId: number, input: CreateInput): Promise<SeriesPreview> {
    const data = CreateSeriesInput.parse(input)
    const db = getDb(ctx)
    const org = await readOrgEventDefaults(ctx, orgId)
    const { occurrences, excluded } = expand(data, org.defaultTimezone)
    const [row] = await db
      .select({ balance: organizationEventBalances.balance })
      .from(organizationEventBalances)
      .where(eq(organizationEventBalances.organizationId, orgId))
    const balanceBefore = row?.balance ?? 0
    const result = await plan(ctx, orgId, data, org, occurrences, balanceBefore)
    return {
      timezone: org.defaultTimezone,
      dates: result.dates.map((d) => ({
        date: d.date,
        startsAt: d.startsAt.toISOString(),
        endsAt: d.endsAt.toISOString(),
        status: d.status,
        draftReason: d.draftReason,
      })),
      excluded,
      total: result.dates.length,
      published: result.published,
      drafts: result.drafts,
      venueConflicts: result.venueConflicts,
      balanceEnforced: result.enforced,
      balanceBefore,
      balanceAfter: result.balanceAfter,
    }
  },

  /**
   * Создать серию атомарно целиком (D-04): одна транзакция — строка серии и все даты; первые
   * `min(N, баланс)` свободных дат публикуются со списанием, остальные — черновики; сбой откатывает
   * всё. Порядок: настройки группы (FOR SHARE) → строка баланса (FOR UPDATE) — она же сериализует
   * параллельные серии группы и повторы по ключу идемпотентности. Advisory-lock новых событий не
   * нужен: до коммита их никто не видит.
   */
  async create(
    ctx: ServiceContext,
    orgId: number,
    input: CreateInput,
  ): Promise<SeriesCreateResult> {
    const data = CreateSeriesInput.parse(input)
    const exceptions = normalizeExceptions(data.exceptions)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const org = await readOrgEventDefaults(tx, orgId)
      const balanceBefore = await lockEventBalance(db, orgId)

      if (data.idempotencyKey) {
        const [existing] = await db
          .select()
          .from(eventSeries)
          .where(
            and(
              eq(eventSeries.organizationId, orgId),
              eq(eventSeries.idempotencyKey, data.idempotencyKey),
            ),
          )
        if (existing) {
          const same =
            stable({ rule: data.rule, exceptions, template: data.template }) ===
            stable({
              rule: existing.rule,
              exceptions: existing.exceptions,
              template: existing.template,
            })
          if (!same) throw new SeriesIdempotencyConflictError()
          const rows = await eventsOf(tx, existing.id)
          const published = rows.filter((e) => e.status !== 'draft').length
          return {
            series: seriesView(existing),
            events: rows,
            total: rows.length,
            published,
            drafts: rows.length - published,
            venueConflicts: null,
            balanceAfter: balanceBefore,
            replayed: true,
          }
        }
      }

      const { occurrences } = expand(data, org.defaultTimezone)
      const result = await plan(tx, orgId, data, org, occurrences, balanceBefore)
      const [series] = await db
        .insert(eventSeries)
        .values({
          organizationId: orgId,
          createdByUserId: tx.userId,
          rule: data.rule,
          exceptions,
          template: data.template,
          timezone: org.defaultTimezone,
          idempotencyKey: data.idempotencyKey ?? null,
        })
        .returning()
      for (const d of result.dates) {
        await insertEvent(tx, orgId, eventInputFor(data.template, d), org, {
          id: series!.id,
          date: d.date,
        })
      }
      const balanceAfter = await lockEventBalance(db, orgId)
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.SERIES_CREATED,
        entityType: 'event_series',
        entityId: series!.id,
        newValue: {
          rule: data.rule,
          exceptions,
          total: result.dates.length,
          published: result.published,
          drafts: result.drafts,
          venueConflicts: result.venueConflicts,
          eventBalance: { before: balanceBefore, after: balanceAfter },
        },
      })
      return {
        series: seriesView(series!),
        events: await eventsOf(tx, series!.id),
        total: result.dates.length,
        published: result.published,
        drafts: result.drafts,
        venueConflicts: result.venueConflicts,
        balanceAfter,
        replayed: false,
      }
    })
  },

  async get(
    ctx: ServiceContext,
    orgId: number,
    seriesId: number,
  ): Promise<{ series: SeriesView; events: SeriesEventView[] }> {
    const [series] = await getDb(ctx)
      .select()
      .from(eventSeries)
      .where(and(eq(eventSeries.id, seriesId), eq(eventSeries.organizationId, orgId)))
    if (!series) throw new SeriesNotFoundError(seriesId)
    return { series: seriesView(series), events: await eventsOf(ctx, series.id) }
  },

  /**
   * Правка «только это» (`single`, дата `from`) или «это и последующие» (`following`: даты `>= from`,
   * кроме прошедших, отменённых и завершённых). Каждое событие меняется через `eventService.update`
   * (те же правила цены, вместимости и режима записи); одна транзакция — ошибка на любой дате
   * откатывает всю правку. `following` обновляет и шаблон серии. Баланс не меняется: статус
   * правкой серии не меняется, публикация черновика — `PATCH …/events/{id}`.
   */
  async update(
    ctx: ServiceContext,
    orgId: number,
    seriesId: number,
    query: UpdateQuery,
    input: UpdateInput,
  ): Promise<{ updated: number; events: SeriesEventView[] }> {
    const q = UpdateSeriesQuery.parse(query)
    const changes = UpdateSeriesInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const series = await lockSeries(tx, orgId, seriesId)
      const targets = await db
        .select({ id: events.id, seriesDate: events.seriesDate })
        .from(events)
        .where(
          q.scope === 'single'
            ? and(eq(events.seriesId, series.id), eq(events.seriesDate, q.from))
            : and(
                eq(events.seriesId, series.id),
                gte(events.seriesDate, q.from),
                notInArray(events.status, ['cancelled', 'finished']),
                gt(events.startsAt, new Date()),
              ),
        )
        .orderBy(asc(events.seriesDate), asc(events.id))
      if (q.scope === 'single' && targets.length === 0) throw new EventNotFoundError(0)
      await lockEventsInOrder(tx, targets)

      const template = series.template as SeriesTemplate
      const { startTime, durationMinutes, ...eventFields } = changes
      for (const target of targets) {
        const patch: UpdateEventInput = { ...eventFields }
        if (startTime !== undefined || durationMinutes !== undefined) {
          const { startsAt, endsAt } = seriesOccurrence(
            target.seriesDate!,
            startTime ?? template.startTime,
            durationMinutes ?? template.durationMinutes,
            series.timezone,
          )
          patch.startsAt = startsAt
          patch.endsAt = endsAt
        }
        await eventService.update(tx, target.id, patch)
      }
      if (q.scope === 'following') {
        await db
          .update(eventSeries)
          .set({ template: { ...template, ...changes }, updatedAt: new Date() })
          .where(eq(eventSeries.id, series.id))
      }
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.SERIES_UPDATED,
        entityType: 'event_series',
        entityId: series.id,
        newValue: { scope: q.scope, from: q.from, changes, updated: targets.length },
      })
      return { updated: targets.length, events: await eventsOf(tx, series.id) }
    })
  },

  /**
   * Отменить дату `from` и все последующие одной командой (решение владельца 2026-10-15, D-04):
   * одна транзакция; события блокируются в порядке `(series_date, id)` до баланса, затем каждое
   * отменяется `eventService.cancel` — возврат баланса по D-09/D-13 (только при списании, без
   * неотменённых записей), записи и платежи по R0.7/20.1.2, уведомления — в коллектор вызывающего.
   * Повтор безопасен: отменённые даты пропускаются, второй возврат запрещён журналом.
   */
  async cancel(
    ctx: ServiceContext,
    orgId: number,
    seriesId: number,
    input: CancelInput,
  ): Promise<{ cancelled: number; balanceRefunds: number; events: SeriesEventView[] }> {
    const { from } = CancelSeriesInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const series = await lockSeries(tx, orgId, seriesId)
      const targets = await db
        .select({ id: events.id })
        .from(events)
        .where(
          and(
            eq(events.seriesId, series.id),
            gte(events.seriesDate, from),
            notInArray(events.status, ['cancelled', 'finished']),
          ),
        )
        .orderBy(asc(events.seriesDate), asc(events.id))
      await lockEventsInOrder(tx, targets)

      const refunds = async () =>
        targets.length === 0
          ? 0
          : (
              await db
                .select({ id: eventBalanceEntries.id })
                .from(eventBalanceEntries)
                .where(
                  and(
                    eq(eventBalanceEntries.reason, 'refund'),
                    inArray(
                      eventBalanceEntries.eventId,
                      targets.map((t) => t.id),
                    ),
                  ),
                )
            ).length
      const refundsBefore = await refunds()
      for (const target of targets) await eventService.cancel(tx, target.id)
      const balanceRefunds = (await refunds()) - refundsBefore

      const [active] = await db
        .select({ id: events.id })
        .from(events)
        .where(
          and(eq(events.seriesId, series.id), notInArray(events.status, ['cancelled', 'finished'])),
        )
        .limit(1)
      if (!active && series.status !== 'ended') {
        await db
          .update(eventSeries)
          .set({ status: 'ended', updatedAt: new Date() })
          .where(eq(eventSeries.id, series.id))
      }
      if (targets.length > 0) {
        await auditService.record(tx, {
          organizationId: orgId,
          action: AUDIT_ACTIONS.SERIES_CANCELLED,
          entityType: 'event_series',
          entityId: series.id,
          newValue: { from, cancelled: targets.length, balanceRefunds },
        })
      }
      return {
        cancelled: targets.length,
        balanceRefunds,
        events: await eventsOf(tx, series.id),
      }
    })
  },
}
