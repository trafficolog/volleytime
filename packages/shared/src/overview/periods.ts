import { DEFAULT_TIMEZONE, dateToZonedInput, zonedInputToDate } from '../datetime/datetime'

/** Полуинтервал [from, to): `from` включительно, `to` нет. */
export interface OverviewPeriod {
  from: Date
  to: Date
}

/** Количество недель ряда «Касса за 4 недели». */
export const OVERVIEW_CASH_WEEKS = 4

export interface OverviewPeriods {
  /** Календарный месяц `now` в зоне группы. */
  month: OverviewPeriod
  /** Предыдущий календарный месяц (для дельты «к прошлому месяцу», 21.4.4). */
  previousMonth: OverviewPeriod
  /** Окно «истекают на неделе»: от `now` на 7 суток вперёд, `to` включительно (21.4.4). */
  expiryWindow: OverviewPeriod
  /** Недели ряда по возрастанию, последняя — текущая (пн–вс в зоне группы). */
  weeks: OverviewPeriod[]
}

/** Зона группы или зона по умолчанию, если значение не распознаётся `Intl`. */
export function safeTimezone(tz: string | null | undefined): string {
  const candidate = tz || DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate })
    return candidate
  } catch {
    return DEFAULT_TIMEZONE
  }
}

/** Горизонт «истекают на неделе» в сутках. */
const EXPIRY_WINDOW_DAYS = 7

const pad = (n: number) => String(n).padStart(2, '0')
const DAY = 86_400_000

/** Полночь календарной даты (UTC-арифметика по y/m/d) → момент в зоне группы. */
function localMidnight(utcMidnightOfDate: number, tz: string): Date {
  const d = new Date(utcMidnightOfDate)
  return zonedInputToDate(
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T00:00`,
    tz,
  )
}

/**
 * Границы месяца и недель обзора кабинета в часовом поясе группы (21.2.18). Неделя — с понедельника
 * 00:00 по следующий понедельник 00:00 (не включая); 4 недели заканчиваются текущей неделей.
 */
export function overviewPeriods(now: Date, timezone: string): OverviewPeriods {
  const tz = safeTimezone(timezone)
  const m = dateToZonedInput(now, tz).match(/^(\d{4})-(\d{2})-(\d{2})T/)!
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])

  const monthFrom = localMidnight(Date.UTC(year, month - 1, 1), tz)
  const monthTo = localMidnight(Date.UTC(year, month, 1), tz)
  const previousFrom = localMidnight(Date.UTC(year, month - 2, 1), tz)

  const today = Date.UTC(year, month - 1, day)
  const sinceMonday = (new Date(today).getUTCDay() + 6) % 7
  const thisMonday = today - sinceMonday * DAY
  const weeks: OverviewPeriod[] = []
  for (let i = OVERVIEW_CASH_WEEKS - 1; i >= 0; i--) {
    weeks.push({
      from: localMidnight(thisMonday - i * 7 * DAY, tz),
      to: localMidnight(thisMonday - (i - 1) * 7 * DAY, tz),
    })
  }
  return {
    month: { from: monthFrom, to: monthTo },
    previousMonth: { from: previousFrom, to: monthFrom },
    expiryWindow: { from: now, to: new Date(now.getTime() + EXPIRY_WINDOW_DAYS * DAY) },
    weeks,
  }
}
