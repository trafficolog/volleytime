import { asc, playerLevels, type PlayerLevelCode } from '@volley-time/db'

import { getDb, type ServiceContext } from '../shared/context'

export interface LevelView {
  code: PlayerLevelCode
  title: string
  description: string
  sortOrder: number
}

export const levelService = {
  /** Справочник уровней В1–В4+ по порядку шкалы (глобальный, без tenant; пагинация не нужна). */
  async list(ctx: ServiceContext): Promise<LevelView[]> {
    return getDb(ctx)
      .select({
        code: playerLevels.code,
        title: playerLevels.title,
        description: playerLevels.description,
        sortOrder: playerLevels.sortOrder,
      })
      .from(playerLevels)
      .orderBy(asc(playerLevels.sortOrder))
  },
}
