import { zonedInputToDate } from '../datetime/datetime'

/**
 * Правило повтора серии событий (20.2.2, ADR v3 «Серии и черновики»). Календарные даты `YYYY-MM-DD`
 * — в часовом поясе группы; время начала превращается в момент UTC отдельно для каждой даты
 * (`seriesOccurrence`), поэтому переход на летнее/зимнее время не сдвигает местное время.
 *
 * - `once` — одна дата `startDate`;
 * - `weekly` — каждую неделю по дням `weekdays` (ISO: 1 — понедельник … 7 — воскресенье);
 * - `biweekly` — раз в 2 недели: недели считаются от понедельника недели `startDate`.
 * Срок — ровно одно из `until` (включительно) или `count` (число повторений до исключений, как
 * COUNT/EXDATE в RFC 5545). Периоды интерфейса «месяц/квартал/год» клиент переводит в `until`.
 */
export type SeriesFreq = 'once' | 'weekly' | 'biweekly'

export interface SeriesRule {
  freq: SeriesFreq
  weekdays: readonly number[]
  startDate: string
  until?: string
  count?: number
}

/** Лимит дат в серии (ADR): год ежедневно в високосном году. */
export const SERIES_MAX_DATES = 366

export class RecurrenceError extends Error {
  constructor(
    readonly reason: 'invalid_rule' | 'too_many_dates',
    message: string,
  ) {
    super(message)
    this.name = 'RecurrenceError'
  }
}

const DAY_MS = 86_400_000

/** Номер дня от эпохи для валидной календарной даты, иначе null. */
function dayNumber(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const ms = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)
  if (new Date(ms).toISOString().slice(0, 10) !== date) return null
  return ms / DAY_MS
}

const dayToDate = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10)

/** ISO-день недели: 1 — понедельник … 7 — воскресенье. */
export function isoWeekday(date: string): number {
  const day = dayNumber(date)
  if (day === null) throw new RecurrenceError('invalid_rule', `Invalid date ${date}`)
  // 1970-01-01 — четверг (4)
  return ((((day + 3) % 7) + 7) % 7) + 1
}

const invalid = (message: string) => new RecurrenceError('invalid_rule', message)

/**
 * Развернуть правило в даты по возрастанию. Исключения убирают совпавшие даты; `excluded` —
 * исключения, которые действительно убрали дату серии. Больше 366 дат — `too_many_dates`.
 */
export function expandSeriesRule(
  rule: SeriesRule,
  exceptions: readonly string[] = [],
): { dates: string[]; excluded: string[] } {
  const start = dayNumber(rule.startDate)
  if (start === null) throw invalid('startDate is not a valid date')
  for (const ex of exceptions) {
    if (dayNumber(ex) === null) throw invalid(`exception ${ex} is not a valid date`)
  }
  const skip = new Set(exceptions)

  let generated: string[]
  if (rule.freq === 'once') {
    if (rule.until !== undefined || rule.count !== undefined) {
      throw invalid('once takes neither until nor count')
    }
    generated = [rule.startDate]
  } else {
    const weekdays = new Set(rule.weekdays)
    if (
      rule.weekdays.length === 0 ||
      weekdays.size !== rule.weekdays.length ||
      rule.weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
    ) {
      throw invalid('weekdays must be distinct integers 1..7, at least one')
    }
    if ((rule.until === undefined) === (rule.count === undefined)) {
      throw invalid('exactly one of until or count is required')
    }
    let end = Number.POSITIVE_INFINITY
    if (rule.until !== undefined) {
      const until = dayNumber(rule.until)
      if (until === null || until < start) throw invalid('until must be a date not before start')
      end = until
    }
    const count = rule.count ?? Number.POSITIVE_INFINITY
    if (rule.count !== undefined && (!Number.isInteger(count) || count < 1)) {
      throw invalid('count must be a positive integer')
    }
    // начало недели startDate (понедельник) — точка отсчёта «раз в 2 недели»
    const weekStart = start - (isoWeekday(rule.startDate) - 1)
    // остаток после исключений не может превысить лимит, если сгенерировано не больше этого
    const hardCap = SERIES_MAX_DATES + skip.size
    generated = []
    for (let day = start; day <= end && generated.length < count; day++) {
      const date = dayToDate(day)
      if (!weekdays.has(isoWeekday(date))) continue
      if (rule.freq === 'biweekly' && Math.floor((day - weekStart) / 7) % 2 !== 0) continue
      generated.push(date)
      if (generated.length > hardCap) break
    }
  }

  const dates = generated.filter((d) => !skip.has(d))
  if (dates.length > SERIES_MAX_DATES) {
    throw new RecurrenceError(
      'too_many_dates',
      `A series may have at most ${SERIES_MAX_DATES} dates`,
    )
  }
  if (dates.length === 0) throw invalid('the rule produces no dates')
  return { dates, excluded: generated.filter((d) => skip.has(d)) }
}

/** Начало и конец даты серии: местное время `startTime` (`HH:MM`) в зоне группы, длительность в минутах. */
export function seriesOccurrence(
  date: string,
  startTime: string,
  durationMinutes: number,
  timezone: string,
): { startsAt: Date; endsAt: Date } {
  const startsAt = zonedInputToDate(`${date}T${startTime}`, timezone)
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000) }
}
