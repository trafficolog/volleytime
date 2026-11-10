/** Форма данных обзора кабинета для управляющего (W-02, 21.2.18). Даты — ISO-строки (UTC). */

export interface OverviewPendingPayment {
  /** Первый платёж строки: по нему подтверждение и отклонение действуют на всю запись. */
  id: number
  /** Сумма строки в минимальных единицах валюты `currency` (платежи мест одной записи сложены). */
  amount: number
  currency: string
  seats: number
  createdAt: string
  user: { id: number; name: string | null; telegramUsername: string | null }
  event: { id: number; title: string; startsAt: string } | null
  plan: { name: string } | null
  collection: { id: number; title: string } | null
}

export interface OverviewCashWeek {
  /** Начало недели (понедельник 00:00 в зоне группы), включительно. */
  from: string
  /** Начало следующей недели, не включительно. */
  to: string
  /** Поступления кассы за неделю в валюте группы (минимальные единицы). */
  income: number
  /** Расходы кассы за неделю, включая возвраты (`refund`). */
  expense: number
  /** `income − expense`: возвращённые платежи уже вычтены. */
  net: number
}

/** Подписи-дельты обзора (W-02, 21.4.4). */
export interface OverviewDeltas {
  /** Предыдущий календарный месяц в зоне группы: [from, to). */
  previousMonth: { from: string; to: string }
  /**
   * `events.thisMonth` минус число событий прошлого месяца (то же правило: без черновиков и
   * отменённых). `null`, если в прошлом месяце событий не было: сравнивать не с чем.
   */
  eventsVsPreviousMonth: number | null
  /** Действующие абонементы, срок которых истекает в ближайшие 7 суток (включительно). */
  subscriptionsExpiringSoon: number
  /** `net` текущей недели ряда кассы (`cashWeekly.weeks[3].net`), валюта группы. */
  cashWeekNet: number
}

export interface ManagerOverview {
  timezone: string
  currency: string
  /** Календарный месяц в зоне группы: [from, to). */
  month: { from: string; to: string }
  events: {
    /** События месяца, кроме черновиков и отменённых. */
    thisMonth: number
  }
  bookings: {
    /** Записи (строки) на события месяца, занимающие места: без списка ожидания и отменённых. */
    count: number
    /** Занятые места на события месяца. */
    seats: number
    /** Вместимость событий месяца. */
    capacity: number
    /** `seats / capacity`, целые проценты; `null`, если вместимость нулевая (нет событий). */
    occupancyPercent: number | null
  }
  subscriptions: {
    /** Действующие абонементы группы: `active`, не истёк, остались занятия. */
    active: number
  }
  pendingPayments: {
    /** Число строк `items`. */
    count: number
    /** Сумма строк в валюте группы (строки в другой валюте не складываются). */
    amount: number
    currency: string
    /** От старых к новым. */
    items: OverviewPendingPayment[]
  }
  deltas: OverviewDeltas
  cashWeekly: {
    currency: string
    /** 4 недели по возрастанию, последняя — текущая. */
    weeks: OverviewCashWeek[]
    total: { income: number; expense: number; net: number }
  }
}
