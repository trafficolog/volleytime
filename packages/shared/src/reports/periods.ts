import { dateToZonedInput, zonedInputToDate } from '../datetime/datetime'
import { safeTimezone } from '../overview/periods'

/** Предел периода отчёта в днях: год (включая високосный). */
export const REPORT_MAX_DAYS = 366
/** Периоды длиннее этого разбиваются на календарные месяцы, короче — на недели. */
const WEEKLY_BUCKETS_MAX_DAYS = 92

const DAY = 86_400_000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const pad = (n: number) => String(n).padStart(2, '0')

/** Календарная дата `YYYY-MM-DD` → UTC-полночь; `null`, если строка не настоящая дата. */
function parseDate(value: string): number | null {
  const m = DATE_RE.exec(value)
  if (!m) return null
  const ts = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)
  const d = new Date(ts)
  return d.getUTCFullYear() === +m[1]! &&
    d.getUTCMonth() === +m[2]! - 1 &&
    d.getUTCDate() === +m[3]!
    ? ts
    : null
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Полночь календарной даты в зоне группы. */
function localMidnight(ts: number, tz: string): Date {
  return zonedInputToDate(`${formatDate(ts)}T00:00`, tz)
}

/** Полуинтервал [from, to): `from` включительно, `to` нет. */
export interface ReportPeriod {
  from: Date
  to: Date
}

/**
 * Период отчёта из дат группы: `from` и `to` — локальные даты `YYYY-MM-DD`, обе включительно.
 * Границы — полночь зоны группы: [from 00:00, день после `to` 00:00). `null` для неверного
 * формата, перевёрнутого или длиннее года периода.
 */
export function resolveReportPeriod(
  from: string,
  to: string,
  timezone: string,
): ReportPeriod | null {
  const start = parseDate(from)
  const end = parseDate(to)
  if (start === null || end === null || end < start) return null
  if ((end - start) / DAY + 1 > REPORT_MAX_DAYS) return null
  const tz = safeTimezone(timezone)
  return { from: localMidnight(start, tz), to: localMidnight(end + DAY, tz) }
}

/** Предыдущий период той же длины, вплотную перед `from` (в датах группы, без часов). */
export function previousReportDates(from: string, to: string): { from: string; to: string } {
  const start = parseDate(from)!
  const days = (parseDate(to)! - start) / DAY + 1
  return { from: formatDate(start - days * DAY), to: formatDate(start - DAY) }
}

export interface ReportPeriodPreset {
  key: 'month' | 'prev-month' | 'quarter' | 'year'
  label: string
  /** Локальные даты группы, обе включительно. */
  from: string
  to: string
}

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

/** Быстрые периоды экрана «Отчёты» по «сегодня» в зоне группы. */
export function reportPeriodPresets(now: Date, timezone: string): ReportPeriodPreset[] {
  const tz = safeTimezone(timezone)
  const [y, mo] = dateToZonedInput(now, tz).slice(0, 7).split('-').map(Number) as [number, number]
  const last = (year: number, month1: number) => Date.UTC(year, month1, 0) // последний день месяца
  const monthPreset = (
    key: 'month' | 'prev-month',
    year: number,
    month1: number,
  ): ReportPeriodPreset => ({
    key,
    label: `${MONTHS[month1 - 1]} ${year}`,
    from: formatDate(Date.UTC(year, month1 - 1, 1)),
    to: formatDate(last(year, month1)),
  })
  const prevYear = mo === 1 ? y - 1 : y
  const prevMonth = mo === 1 ? 12 : mo - 1
  const q = Math.floor((mo - 1) / 3)
  return [
    monthPreset('month', y, mo),
    monthPreset('prev-month', prevYear, prevMonth),
    {
      key: 'quarter',
      label: `Q${q + 1} ${y}`,
      from: formatDate(Date.UTC(y, q * 3, 1)),
      to: formatDate(last(y, q * 3 + 3)),
    },
    { key: 'year', label: 'Год', from: `${y}-01-01`, to: `${y}-12-31` },
  ]
}

/** Единица столбцов для периода: недели до 92 дней, дальше календарные месяцы. */
export function reportGranularity(from: string, to: string): 'week' | 'month' {
  return (parseDate(to)! - parseDate(from)!) / DAY + 1 > WEEKLY_BUCKETS_MAX_DAYS ? 'month' : 'week'
}

export interface ReportBucket {
  /** Локальные даты группы, обе включительно. */
  fromDate: string
  toDate: string
  from: Date
  to: Date
}

/**
 * Столбцы динамики кассы: недели пн–вс до 92 дней, дальше календарные месяцы; крайние столбцы
 * обрезаются границами периода, поэтому столбцы смежны и их суммы дают итог периода.
 */
export function reportBuckets(from: string, to: string, timezone: string): ReportBucket[] {
  const tz = safeTimezone(timezone)
  const start = parseDate(from)!
  const end = parseDate(to)!
  const monthly = reportGranularity(from, to) === 'month'
  const buckets: ReportBucket[] = []
  for (let cursor = start; cursor <= end;) {
    const d = new Date(cursor)
    const natural = monthly
      ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - DAY
      : cursor + (6 - ((d.getUTCDay() + 6) % 7)) * DAY
    const last = Math.min(natural, end)
    buckets.push({
      fromDate: formatDate(cursor),
      toDate: formatDate(last),
      from: localMidnight(cursor, tz),
      to: localMidnight(last + DAY, tz),
    })
    cursor = last + DAY
  }
  return buckets
}
