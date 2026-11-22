import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './users'

/**
 * Личные функции игрока (23.1.1, P-12). Хранится только явный выбор игрока: строки нет — функция
 * включена (по умолчанию включено всё). Данные самих функций лежат в своих таблицах и при
 * выключении флага не трогаются. CHECK пускает в таблицу только восемь флагов спецификации.
 */
export const userFeatures = pgTable(
  'user_features',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    feature: varchar('feature', { length: 16 }).notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.feature] }),
    check(
      'user_features_feature_chk',
      sql`${t.feature} IN ('cal', 'coach', 'warmup', 'self', 'mvp', 'teams', 'streak', 'wrapped')`,
    ),
  ],
)

export type UserFeature = typeof userFeatures.$inferSelect
