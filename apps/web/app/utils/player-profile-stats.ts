/** Окно подсчёта совпадает с окном по умолчанию у организатора (`PLAYER_STATS_DEFAULT_DAYS`, 21.2.20). */
export const STATS_WINDOW_NOTE = 'за последние 90 дней'

export interface OwnAttendance {
  visits: number
  noShows: number
  ratePercent: number | null
}

/** Три плитки статистики профиля игрока (M-13): посещения, посещаемость, no-show. */
export function profileStatTiles(a: OwnAttendance): { value: string; label: string }[] {
  return [
    { value: String(a.visits), label: 'тренировок' },
    { value: a.ratePercent === null ? '—' : `${a.ratePercent}%`, label: 'посещ.' },
    { value: String(a.noShows), label: 'no-show' },
  ]
}
