import {
  REPORT_EXPORT_TYPES,
  resolveReportPeriod,
  type ManagerReport,
  type ReportBreakdown,
  type ReportBreakdownDimension,
  type ReportBreakdownFigures,
  type ReportExportType,
  type ReportPlayerAttendance,
} from '@volley-time/shared'

import { signedMoney } from './desktop-cashbox'
import { pluralRu } from './desktop-players'
import { LEDGER_CATEGORY_LABELS, formatMoneyRu } from './labels'

/** Отчёты кабинета (W-10, 21.2.7): подготовка данных API к показу; цифры считает сервер. */

export interface ReportDates {
  from: string
  to: string
}

export interface ReportKpi {
  label: string
  value: string
  caption: string
  tone: 'positive' | 'negative' | 'neutral'
}

const SHORT_MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]

/** Четыре плитки экрана: касса нетто, поступления, расходы, заполняемость. */
export function reportKpis(report: ManagerReport): ReportKpi[] {
  const { money, occupancy, currency } = report
  const last = money.buckets.at(-1)
  const unit = money.granularity === 'month' ? 'последний месяц' : 'последняя неделя'
  const tone = (n: number): ReportKpi['tone'] =>
    n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral'

  const delta =
    occupancy.percent !== null && occupancy.previous.percent !== null
      ? occupancy.percent - occupancy.previous.percent
      : null
  const occupancyCaption =
    occupancy.percent === null
      ? 'нет событий за период'
      : delta === null
        ? 'нет данных за прошлый период'
        : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta)}% к прошлому периоду`

  const categories = money.expenseByCategory.length
  return [
    {
      label: 'Чистая касса',
      value: signedMoney(money.net, currency),
      caption:
        last && money.buckets.length > 1
          ? `${signedMoney(last.net, currency)} ${unit}`
          : 'нет операций',
      tone: tone(money.net),
    },
    {
      label: 'Поступления',
      value:
        money.income > 0 ? `+${formatMoneyRu(money.income, currency)}` : formatMoneyRu(0, currency),
      caption: `${occupancy.events} ${pluralRu(occupancy.events, 'событие', 'события', 'событий')}`,
      tone: 'neutral',
    },
    {
      label: 'Расходы',
      value:
        money.expense > 0
          ? `−${formatMoneyRu(money.expense, currency)}`
          : formatMoneyRu(0, currency),
      caption: `${categories} ${pluralRu(categories, 'категория', 'категории', 'категорий')}`,
      tone: money.expense > 0 ? 'negative' : 'neutral',
    },
    {
      label: 'Заполняемость',
      value: occupancy.percent === null ? '—' : `${occupancy.percent}%`,
      caption: occupancyCaption,
      tone: 'neutral',
    },
  ]
}

export interface ReportCashBar {
  key: string
  label: string
  /** Высота частей столбца в процентах от самого большого столбца. */
  incomePercent: number
  expensePercent: number
  title: string
}

/** Столбцы «Касса по неделям»: поступления над расходами, подписи Н1.. или месяц. */
export function reportCashBars(report: ManagerReport): ReportCashBar[] {
  const { buckets, granularity } = report.money
  const max = Math.max(0, ...buckets.map((b) => b.income + b.expense))
  const pct = (n: number) => (max === 0 ? 0 : Math.round((n / max) * 100))
  return buckets.map((b, i) => {
    const label =
      granularity === 'month'
        ? (SHORT_MONTHS[Number(b.fromDate.slice(5, 7)) - 1] ?? '')
        : `Н${i + 1}`
    return {
      key: b.fromDate,
      label,
      incomePercent: pct(b.income),
      expensePercent: pct(b.expense),
      title: `${label}: +${formatMoneyRu(b.income, report.currency)}, −${formatMoneyRu(b.expense, report.currency)}`,
    }
  })
}

export interface ExpenseCategoryRow {
  category: string
  label: string
  value: string
  /** Доля категории в расходах периода, целые проценты. */
  percent: number
}

/** Историческая «Зарплата» остаётся отдельной категорией, отличной от «Тренер» (решение владельца). */
export function expenseCategoryLabel(category: string): string {
  return category === 'salary'
    ? 'Зарплата (прежние записи)'
    : (LEDGER_CATEGORY_LABELS[category] ?? category)
}

export function expenseCategoryRows(report: ManagerReport): ExpenseCategoryRow[] {
  const { expense, expenseByCategory } = report.money
  return expenseByCategory.map((row) => ({
    category: row.category,
    label: expenseCategoryLabel(row.category),
    value: `−${formatMoneyRu(row.amount, report.currency)}`,
    percent: expense > 0 ? Math.round((row.amount / expense) * 100) : 0,
  }))
}

export function reportPlayerName(
  p: Pick<ReportPlayerAttendance, 'name' | 'telegramUsername'>,
): string {
  if (p.name?.trim()) return p.name.trim()
  return p.telegramUsername ? `@${p.telegramUsername}` : 'Игрок'
}

/** Отчёты, доступные для выгрузки. «Абонементы» макета в объём 21.2.7 не входят. */
export const REPORT_TYPE_OPTIONS: { type: ReportExportType; title: string; icon: string }[] = [
  { type: 'finance', title: 'Финансовый отчёт', icon: 'wallet' },
  { type: 'attendance', title: 'Посещаемость', icon: 'users' },
]

/** Размер файла в КБ с запятой: «≈ 4,8 КБ»; не меньше 0,1. */
export function formatExportSize(bytes: number): string {
  const kb = Math.max(0.1, Math.round((bytes / 1024) * 10) / 10)
  return `≈ ${String(kb).replace('.', ',')} КБ`
}

/** Период из строки адреса экрана; неверные или неполные даты — `fallback`. */
export function periodFromQuery(
  query: Record<string, unknown>,
  fallback: ReportDates,
): ReportDates {
  const { from, to } = query
  if (typeof from === 'string' && typeof to === 'string' && resolveReportPeriod(from, to, 'UTC')) {
    return { from, to }
  }
  return fallback
}

/** Тип выгрузки из адреса экрана; неизвестный — финансовый. */
export function exportTypeFromQuery(value: unknown): ReportExportType {
  return REPORT_EXPORT_TYPES.find((t) => t === value) ?? 'finance'
}

export function reportQuery(dates: ReportDates): ReportDates {
  return { from: dates.from, to: dates.to }
}

/** Ссылка на файл выгрузки; колонки не заданы — сервер берёт набор по умолчанию. */
export function reportExportHref(
  orgId: number,
  type: ReportExportType,
  dates: ReportDates,
  columns?: string[],
): string {
  const params = new URLSearchParams({ type, from: dates.from, to: dates.to })
  if (columns) params.set('columns', columns.join(','))
  return `/api/organizations/${orgId}/reports/export?${params.toString()}`
}

/** Переключатель разреза отчёта (W-19). */
export const BREAKDOWN_OPTIONS: { value: ReportBreakdownDimension; label: string }[] = [
  { value: 'coach', label: 'По тренерам' },
  { value: 'venue', label: 'По залам' },
  { value: 'series', label: 'По сериям' },
]

const BREAKDOWN_NOT_SET: Record<ReportBreakdownDimension, string> = {
  coach: 'Без тренера',
  venue: 'Без зала',
  series: 'Вне серий',
}

export interface BreakdownCells {
  events: string
  occupancy: string
  income: string
  rent: string
}

export interface BreakdownTableRow extends BreakdownCells {
  key: string
  label: string
  /** Строка «Не указано»: приглушённая подпись. */
  muted: boolean
}

function breakdownCells(f: ReportBreakdownFigures, currency: string): BreakdownCells {
  return {
    events: String(f.events),
    occupancy: f.percent === null ? '—' : `${f.percent}%`,
    income: formatMoneyRu(f.income, currency),
    rent: formatMoneyRu(f.rent, currency),
  }
}

/** Строки таблицы «В разрезе»: цифры считает сервер, здесь только подписи и форматирование. */
export function breakdownRows(report: ReportBreakdown): {
  rows: BreakdownTableRow[]
  total: BreakdownCells
} {
  return {
    rows: report.rows.map((row) => ({
      key: row.key === null ? 'none' : String(row.key),
      label: row.label ?? (row.key === null ? BREAKDOWN_NOT_SET[report.dimension] : 'Без названия'),
      muted: row.key === null,
      ...breakdownCells(row, report.currency),
    })),
    total: breakdownCells(report.totals, report.currency),
  }
}
