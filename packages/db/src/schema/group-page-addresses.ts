import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, primaryKey, timestamp, varchar } from 'drizzle-orm/pg-core'

import { organizations } from './organizations'

/**
 * История адресов страницы группы (24.2.1, D-26): прежние пары `/{город}/{группа}`, с которых
 * действующий адрес отвечает 301 после смены города или slug владельцем. `city_slug = ''` —
 * прежний адрес без города справочника (`/g/<slug>`). Один прежний адрес — одна группа (PK):
 * если адрес освободился и снова ушёл в историю, запись переходит к последней группе.
 * Действующий адрес группы здесь не хранится — он считается из `organizations.city` и `slug`.
 */
export const groupPageAddresses = pgTable(
  'group_page_addresses',
  {
    citySlug: varchar('city_slug', { length: 64 }).notNull(),
    groupSlug: varchar('group_slug', { length: 64 }).notNull(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.citySlug, t.groupSlug] }),
    index('group_page_addresses_group_slug_idx').on(t.groupSlug),
    index('group_page_addresses_org_idx').on(t.organizationId),
    check('group_page_addresses_city_slug_chk', sql`${t.citySlug} ~ '^([a-z0-9-]{1,64})?$'`),
    check('group_page_addresses_group_slug_chk', sql`${t.groupSlug} ~ '^[a-z0-9][a-z0-9-]{0,63}$'`),
  ],
)

export type GroupPageAddress = typeof groupPageAddresses.$inferSelect
