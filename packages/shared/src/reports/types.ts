/** Форма данных отчётов кабинета (W-10, 21.2.7). Деньги — минорные единицы, даты — ISO (UTC). */

export const REPORT_EXPORT_TYPES = ['finance', 'attendance'] as const
export type ReportExportType = (typeof REPORT_EXPORT_TYPES)[number]

/** Колонки CSV-выгрузок: ключ — в запросе `columns`, подпись — в заголовке файла и на экране. */
export const REPORT_EXPORT_COLUMNS: Record<
  ReportExportType,
  readonly { key: string; label: string; default: boolean }[]
> = {
  finance: [
    { key: 'date', label: 'Дата', default: true },
    { key: 'type', label: 'Тип', default: true },
    { key: 'category', label: 'Категория', default: true },
    { key: 'description', label: 'Описание', default: true },
    { key: 'event', label: 'Событие', default: true },
    { key: 'method', label: 'Способ', default: true },
    { key: 'amount', label: 'Сумма', default: true },
    { key: 'currency', label: 'Валюта', default: true },
    { key: 'payer', label: 'Плательщик', default: true },
    { key: 'author', label: 'Внёс', default: false },
  ],
  attendance: [
    { key: 'player', label: 'Игрок', default: true },
    { key: 'visits', label: 'Тренировок', default: true },
    { key: 'seats', label: 'Мест всего', default: true },
    { key: 'noShows', label: 'Неявки', default: true },
    { key: 'cancellations', label: 'Отмены', default: true },
    { key: 'lastVisit', label: 'Последний визит', default: true },
    { key: 'level', label: 'Уровень', default: false },
  ],
}

export interface ReportPlayerAttendance {
  userId: number
  name: string | null
  telegramUsername: string | null
  /** Уровень игрока в группе; `null`, если не задан. */
  level: string | null
  /** Записи со статусом «пришёл» на события периода. */
  visits: number
  /** Места, занятые такими записями (запись может держать несколько мест). */
  seats: number
  /** Записи со статусом «не пришёл». */
  noShows: number
  /** Отменённые записи на события периода. */
  cancellations: number
  /** Начало последнего события периода, на которое игрок пришёл; `null`, если не приходил. */
  lastVisitAt: string | null
}

export interface ReportCashBucket {
  from: string
  to: string
  /** Локальные даты группы, обе включительно: подпись столбца. */
  fromDate: string
  toDate: string
  income: number
  expense: number
  net: number
}

export interface ReportExpenseCategory {
  /** Ключ категории журнала кассы; `salary` — историческая «Зарплата», отдельная от «Тренера». */
  category: string
  amount: number
  /** Записей журнала в категории. */
  count: number
}

export interface ReportOccupancy {
  /** События периода, кроме черновиков и отменённых. */
  events: number
  seats: number
  capacity: number
  /** Целые проценты; `null`, если вместимость нулевая. */
  percent: number | null
}

export interface ManagerReport {
  timezone: string
  currency: string
  /** Локальные даты группы, обе включительно. */
  period: { from: string; to: string }
  previous: { from: string; to: string }
  money: {
    income: number
    expense: number
    net: number
    /** Единица столбцов динамики: недели для периодов до 92 дней, дальше календарные месяцы. */
    granularity: 'week' | 'month'
    /** Столбцы динамики в порядке времени. */
    buckets: ReportCashBucket[]
    /** Расходы периода по категориям, от большей суммы к меньшей; сумма равна `expense`. */
    expenseByCategory: ReportExpenseCategory[]
  }
  occupancy: ReportOccupancy & {
    /** То же за предыдущий период той же длины. */
    previous: ReportOccupancy
  }
  attendance: {
    visits: number
    noShows: number
    cancellations: number
    /** Игроки с посещениями, от большего числа к меньшему (топ экрана — первые строки). */
    top: ReportPlayerAttendance[]
  }
}

export interface ReportExportPreview {
  type: ReportExportType
  columns: { key: string; label: string }[]
  /** Первые строки выгрузки в виде готовых к показу ячеек. */
  rows: string[][]
  total: number
  /** Размер файла в байтах. */
  bytes: number
}
