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

import { organizations } from './organizations'

/**
 * Переключатели уведомлений группы (21.2.14, W-11). Хранится только явный выбор организатора:
 * строки нет — тип включён, как было до миграции. Переключаются только напоминания; обязательные
 * типы (предложение места, решение по оплате, отмена события) в таблице не появляются, а
 * CHECK не пускает в неё ничего, кроме переключаемых типов.
 */
export const organizationNotificationSettings = pgTable(
  'organization_notification_settings',
  {
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 32 }).notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.type] }),
    check('org_notification_settings_type_chk', sql`${t.type} IN ('reminder_24h', 'reminder_2h')`),
  ],
)

export type OrganizationNotificationSetting = typeof organizationNotificationSettings.$inferSelect
