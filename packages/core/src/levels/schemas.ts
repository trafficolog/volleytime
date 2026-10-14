import { PLAYER_LEVEL_CODES } from '@volley-time/db'
import { z } from 'zod'

/** Код уровня (enum player_level). */
export const LevelCode = z.enum(PLAYER_LEVEL_CODES)

/** Порядок шкалы: от В1 к В4+ (совпадает с sort_order справочника). */
export function sortLevels<T extends string>(codes: readonly T[]): T[] {
  const rank = (c: string) => PLAYER_LEVEL_CODES.indexOf(c as (typeof PLAYER_LEVEL_CODES)[number])
  return [...new Set(codes)].sort((a, b) => rank(a) - rank(b))
}

/** Уровни группы: без повторов, в порядке шкалы; пустой список допустим. */
export const GroupLevelsInput = z
  .array(LevelCode)
  .max(PLAYER_LEVEL_CODES.length)
  .transform((codes) => sortLevels(codes))
