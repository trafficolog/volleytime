/**
 * Обзор платформы для Root Admin (Task 22.1.1, `/api/platform/overview`).
 * Недели — скользящие окна по 7 суток, заканчивающиеся в `generatedAt`; дни в ряду записей — сутки UTC.
 */
export type PlatformGateKey =
  'activeOrganizers' | 'retention4weeks' | 'totalEvents' | 'totalBookings'

/** Метрика гипотезы Phase 10: значение против цели гейта (задача 10.3.2). */
export interface PlatformGateMetric {
  key: PlatformGateKey
  value: number
  target: number
  reached: boolean
}

export interface PlatformWeekCounter {
  current: number
  previous: number
}

export interface PlatformOverview {
  generatedAt: string
  northStar: {
    /** Группы с событием или новой записью за последние 7 суток. */
    activeThisWeek: number
    activePreviousWeek: number
    /** Зарегистрированные группы: не архивные и не удалённые. */
    registered: number
  }
  week: {
    events: PlatformWeekCounter
    bookings: PlatformWeekCounter
  }
  /** 14 суток UTC по возрастанию, последний — текущие сутки; пустые дни — 0. */
  bookingsDaily: { date: string; count: number }[]
  gate: PlatformGateMetric[]
}
