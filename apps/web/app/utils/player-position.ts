/**
 * Амплуа игрока (21.2.22). Коды совпадают с enum `player_position`; подписи только в UI.
 * Порядок — порядок выбора в карточке игрока.
 */
export const PLAYER_POSITIONS = [
  { code: 'setter', title: 'Связующий' },
  { code: 'outside_hitter', title: 'Доигровщик' },
  { code: 'opposite', title: 'Диагональный' },
  { code: 'middle_blocker', title: 'Центральный блокирующий' },
  { code: 'libero', title: 'Либеро' },
  { code: 'utility', title: 'Универсал' },
] as const

/** Подпись амплуа по коду; null, если амплуа не задано или код неизвестен. */
export function positionTitle(code: string | null | undefined): string | null {
  if (!code) return null
  return PLAYER_POSITIONS.find((p) => p.code === code)?.title ?? null
}
