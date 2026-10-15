/** Справочник уровней В1–В4+ из GET /api/levels (порядок шкалы: от В1 к В4+). */
export interface PlayerLevelView {
  code: string
  title: string
  description: string
  sortOrder: number
}

export const LEVEL_FILTER_ALL = 'all'
/** Игроки без назначенного уровня. */
export const LEVEL_FILTER_NONE = 'none'

/** Подпись уровня по коду из справочника; null, если уровня нет или код неизвестен. */
export function levelTitle(
  code: string | null | undefined,
  levels: readonly PlayerLevelView[],
): string | null {
  if (!code) return null
  return levels.find((level) => level.code === code)?.title ?? null
}

/** Фильтр состава по уровню: «all» — все, «none» — без уровня, иначе код уровня. */
export function filterByLevel<T extends { level: string | null }>(
  rows: readonly T[],
  filter: string,
): T[] {
  if (filter === LEVEL_FILTER_ALL) return [...rows]
  if (filter === LEVEL_FILTER_NONE) return rows.filter((row) => row.level === null)
  return rows.filter((row) => row.level === filter)
}

/** Варианты фильтра: «Все», уровни по шкале, «Без уровня». */
export function levelFilterOptions(
  levels: readonly PlayerLevelView[],
): { value: string; label: string }[] {
  return [
    { value: LEVEL_FILTER_ALL, label: 'Все' },
    ...[...levels]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((level) => ({ value: level.code, label: level.title })),
    { value: LEVEL_FILTER_NONE, label: 'Без уровня' },
  ]
}
