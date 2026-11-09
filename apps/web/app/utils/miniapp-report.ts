import { reportPeriodPresets, type ManagerReport } from '@volley-time/shared'

import { reportKpis, reportPlayerName } from '~/utils/desktop-reports'

/**
 * Отчёт за месяц в Mini App организатора (M-24, 21.1.3). Цифры считает сервер (`reportsService`,
 * 21.2.7) и показывает кабинет (W-10); здесь только выбор месяца и подготовка к показу.
 */

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && MONTH_KEY.test(value)
}

/** Месяц «сегодня» в зоне группы как `YYYY-MM`. */
export function currentMonthKey(now: Date, timezone: string): string {
  return reportPeriodPresets(now, timezone)[0]!.from.slice(0, 7)
}

/** Месяц из адреса экрана; неверный или будущий — текущий месяц группы. */
export function monthFromQuery(value: unknown, current: string): string {
  return isMonthKey(value) && value <= current ? value : current
}

/** Сдвиг месяца `YYYY-MM` на `delta` месяцев. */
export function shiftReportMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Даты месяца (обе включительно) и подпись «Май 2026» — из тех же пресетов, что в кабинете. */
export function reportMonthPeriod(key: string): { from: string; to: string; label: string } {
  const [y, m] = key.split('-').map(Number) as [number, number]
  const preset = reportPeriodPresets(new Date(Date.UTC(y, m - 1, 15, 12)), 'UTC')[0]!
  return { from: preset.from, to: preset.to, label: preset.label }
}

export interface MiniappReportView {
  net: { value: string; negative: boolean }
  income: string
  expense: string
  events: { value: string; caption: string }
  occupancy: { value: string; caption: string }
  visits: { value: string; caption: string }
  top: { userId: number; name: string; visits: string }[]
}

/** Плитки экрана из тех же функций, что плитки кабинета: значения совпадают строка в строку. */
export function miniappReportView(report: ManagerReport): MiniappReportView {
  const [net, income, expense, occupancy] = reportKpis(report)
  const { attendance, occupancy: occ } = report
  return {
    net: { value: net!.value, negative: net!.tone === 'negative' },
    income: income!.value,
    expense: expense!.value,
    events: { value: String(occ.events), caption: 'без черновиков и отменённых' },
    occupancy: { value: occupancy!.value, caption: occupancy!.caption },
    visits: {
      value: String(attendance.visits),
      caption: `неявок ${attendance.noShows} · отмен ${attendance.cancellations}`,
    },
    top: attendance.top.slice(0, 5).map((p) => ({
      userId: p.userId,
      name: reportPlayerName(p),
      visits: `${p.visits} трен.`,
    })),
  }
}
