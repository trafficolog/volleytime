import { pgTable, smallint, text } from 'drizzle-orm/pg-core'

import { playerLevelEnum } from './level-enums'

/** Глобальный справочник уровней В1–В4+ (19.2.3). Заполняется миграцией, не tenant-данные. */
export const playerLevels = pgTable('player_levels', {
  code: playerLevelEnum('code').primaryKey(),
  sortOrder: smallint('sort_order').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
})

export type PlayerLevel = typeof playerLevels.$inferSelect
