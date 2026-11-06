import { dateToZonedInput } from '../datetime/datetime'
import { safeTimezone } from '../overview/periods'

/** Окно посещаемости в списке игроков по умолчанию: последние 90 дней группы (включая сегодня). */
export const PLAYER_STATS_DEFAULT_DAYS = 90

/**
 * Форма агрегатов игрока для кабинета (W-06, 21.2.20). Только для управляющих группы. Деньги —
 * минорные единицы, даты — ISO (UTC). Посещаемость — за период ответа, абонемент и долг — на
 * момент запроса (не зависят от периода).
 */
export interface PlayerStats {
  attendance: {
    /** Записи со статусом «пришёл» на события периода (то же число, что в отчёте посещаемости). */
    visits: number
    noShows: number
    cancellations: number
    /** Доля посещаемости, %: visits / (visits + noShows); `null`, если нет ни визитов, ни неявок. */
    ratePercent: number | null
    /** Начало последнего события периода, на которое игрок пришёл; `null` — не приходил. */
    lastVisitAt: string | null
  }
  /** Действующие абонементы игрока (активные, не истёкшие, с остатком); `null` — нет. */
  subscription: {
    /** Остаток занятий по всем действующим абонементам. */
    remaining: number
    total: number
    /** Ближайший срок действия среди абонементов со сроком; `null` — все бессрочные. */
    expiresAt: string | null
    count: number
  } | null
  /** Неоплаченные места записей (живые `pending`-платежи) в валюте группы. */
  debt: { amount: number; seats: number; currency: string }
}

export interface PlayersStatsPeriod {
  /** Локальные даты группы, обе включительно. */
  from: string
  to: string
}

/** Доля посещаемости в процентах; `null`, когда считать не из чего. */
export function attendanceRatePercent(visits: number, noShows: number): number | null {
  const total = visits + noShows
  return total > 0 ? Math.round((visits / total) * 100) : null
}

/** Окно по умолчанию: `PLAYER_STATS_DEFAULT_DAYS` дней, заканчивая сегодняшним днём группы. */
export function defaultPlayerStatsDates(now: Date, timezone: string): PlayersStatsPeriod {
  const to = dateToZonedInput(now, safeTimezone(timezone)).slice(0, 10)
  const [y, m, d] = to.split('-').map(Number) as [number, number, number]
  const start = new Date(Date.UTC(y, m - 1, d - (PLAYER_STATS_DEFAULT_DAYS - 1)))
  return { from: start.toISOString().slice(0, 10), to }
}
