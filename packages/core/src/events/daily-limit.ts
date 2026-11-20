import { and, eq, events, gte, inArray, lt, ne, sql } from '@volley-time/db'
import { addIsoDays, dateToZonedInput, zonedInputToDate } from '@volley-time/shared'

import { getPlatformSettings } from '../platform/settings'
import { getDb, type ServiceContext } from '../shared/context'

import { EventDailyLimitReachedError } from './errors'

/**
 * Дневной лимит опубликованных событий группы (22.3.1, ADR-22-3-1, D-20): сколько событий в
 * статусах `published`, `closed`, `finished` может начинаться в один календарный день часового
 * пояса группы. Лимита нет (`null`), пока root его не задал.
 *
 * Порядок блокировок во всех путях: событие (`pg_advisory_xact_lock(event.id)` / `FOR UPDATE`) →
 * день группы (`lockGroupDay`) → строка баланса (`lockEventBalance`). Блокировка дня берётся
 * независимо от `EVENT_BALANCE_ENFORCED`, только при заданном лимите.
 */
export const DAILY_LIMIT_COUNTED_STATUSES = ['published', 'closed', 'finished'] as const
export const isDailyLimitCounted = (status: string): boolean =>
  (DAILY_LIMIT_COUNTED_STATUSES as readonly string[]).includes(status)

/** Класс (первый ключ) двухключевой advisory-блокировки «день группы»; не пересекается с id событий. */
const DAILY_LIMIT_LOCK_CLASS = 22_031

/** Календарный день момента в часовом поясе группы (`YYYY-MM-DD`). */
export const groupDay = (at: Date, timezone: string): string =>
  dateToZonedInput(at, timezone).slice(0, 10)

/** Текущее значение настройки (из кэша): `null` — лимита нет. */
export async function readDailyLimit(ctx?: ServiceContext): Promise<number | null> {
  return (await getPlatformSettings(ctx))['events.maxPublishedPerDay']
}

/** Блокировка группы на день до конца транзакции (повторный вызов в той же транзакции — без ожидания). */
export async function lockGroupDay(ctx: ServiceContext, orgId: number, day: string): Promise<void> {
  await getDb(ctx).execute(
    sql`SELECT pg_advisory_xact_lock(${DAILY_LIMIT_LOCK_CLASS}::int, hashtext(${`${orgId}:${day}`}))`,
  )
}

/** Заблокировать дни по возрастанию (порядок исключает взаимные ожидания двух серий). */
export async function lockGroupDays(
  ctx: ServiceContext,
  orgId: number,
  days: Iterable<string>,
): Promise<void> {
  for (const day of [...new Set(days)].sort()) await lockGroupDay(ctx, orgId, day)
}

/** События дня группы, которые считаются в лимите; `excludeEventId` — само проверяемое событие. */
export async function countDailyEvents(
  ctx: ServiceContext,
  orgId: number,
  day: string,
  timezone: string,
  excludeEventId?: number,
): Promise<number> {
  const from = zonedInputToDate(`${day}T00:00`, timezone)
  const to = zonedInputToDate(`${addIsoDays(day, 1)}T00:00`, timezone)
  const conds = [
    eq(events.organizationId, orgId),
    inArray(events.status, [...DAILY_LIMIT_COUNTED_STATUSES]),
    gte(events.startsAt, from),
    lt(events.startsAt, to),
  ]
  if (excludeEventId !== undefined) conds.push(ne(events.id, excludeEventId))
  const [row] = await getDb(ctx)
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(...conds))
  return row?.n ?? 0
}

/** Число учитываемых событий по дням группы за период дат серии (одним запросом). */
export async function countDailyEventsByDay(
  ctx: ServiceContext,
  orgId: number,
  firstDay: string,
  lastDay: string,
  timezone: string,
): Promise<Map<string, number>> {
  const from = zonedInputToDate(`${firstDay}T00:00`, timezone)
  const to = zonedInputToDate(`${addIsoDays(lastDay, 1)}T00:00`, timezone)
  const rows = await getDb(ctx)
    .select({
      day: sql<string>`to_char(${events.startsAt} AT TIME ZONE ${timezone}, 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(
      and(
        eq(events.organizationId, orgId),
        inArray(events.status, [...DAILY_LIMIT_COUNTED_STATUSES]),
        gte(events.startsAt, from),
        lt(events.startsAt, to),
      ),
    )
    .groupBy(sql`1`)
  return new Map(rows.map((r) => [r.day, r.n]))
}

/**
 * Проверить лимит перед появлением нового учитываемого события в дне `startsAt`: блокирует день
 * группы, считает уже учитываемые события дня и отказывает 409, если их не меньше лимита.
 * `limit === null` — лимита нет, ничего не блокируется. Вызывать до блокировки баланса.
 */
export async function enforceDailyLimit(
  ctx: ServiceContext,
  params: {
    orgId: number
    timezone: string
    startsAt: Date
    limit: number | null
    excludeEventId?: number
  },
): Promise<void> {
  if (params.limit === null) return
  const day = groupDay(params.startsAt, params.timezone)
  await lockGroupDay(ctx, params.orgId, day)
  const taken = await countDailyEvents(
    ctx,
    params.orgId,
    day,
    params.timezone,
    params.excludeEventId,
  )
  if (taken >= params.limit) throw new EventDailyLimitReachedError(day, params.limit)
}
