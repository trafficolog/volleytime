import { sql } from 'drizzle-orm'
import { check, integer, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { users } from './users'

/**
 * Страница группы (24.1.1, W-13, решение D-24): содержимое конструктора, одна строка на группу
 * (PK = `organization_id`). Строки нет — страница по умолчанию (`defaultGroupPageContent` в
 * `@volley-time/shared`). `sections` — массив из восьми секций в порядке показа; форму проверяет
 * Zod-схема `GroupPageContent` на сервере до записи, CHECK — страховка от не-массива. Индексация —
 * не здесь, а `organizations.seo_index`; публикация страницы (`public_page_enabled`) — за 24.1.2.
 */
export const organizationGroupPages = pgTable(
  'organization_group_pages',
  {
    organizationId: integer('organization_id')
      .primaryKey()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sections: jsonb('sections').notNull(),
    /** NULL — title по умолчанию («<Название> — волейбол, <Город>»). */
    metaTitle: varchar('meta_title', { length: 120 }),
    /** NULL — description по умолчанию. */
    metaDescription: varchar('meta_description', { length: 320 }),
    updatedByUserId: integer('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('organization_group_pages_sections_chk', sql`jsonb_typeof(${t.sections}) = 'array'`),
  ],
)

export type OrganizationGroupPage = typeof organizationGroupPages.$inferSelect
