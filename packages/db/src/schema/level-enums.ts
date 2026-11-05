import { pgEnum } from 'drizzle-orm/pg-core'

// Код уровня латиницей; подпись «В1…В4+» и описание — в справочнике player_levels (19.2.3).
// Порядок значений = порядок шкалы от сильного к начинающему.
export const PLAYER_LEVEL_CODES = ['v1', 'v2', 'v3', 'v4', 'v4_plus'] as const
export type PlayerLevelCode = (typeof PLAYER_LEVEL_CODES)[number]
export const playerLevelEnum = pgEnum('player_level', PLAYER_LEVEL_CODES)

// Амплуа игрока на площадке (21.2.22): связующий, доигровщик, диагональный, центральный блокирующий,
// либеро, универсал. Подписи — в UI (apps/web/app/utils/player-position.ts).
export const PLAYER_POSITION_CODES = [
  'setter',
  'outside_hitter',
  'opposite',
  'middle_blocker',
  'libero',
  'utility',
] as const
export type PlayerPositionCode = (typeof PLAYER_POSITION_CODES)[number]
export const playerPositionEnum = pgEnum('player_position', PLAYER_POSITION_CODES)
