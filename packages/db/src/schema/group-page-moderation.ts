import { sql } from 'drizzle-orm'
import {
  check,
  char,
  date,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { users } from './users'

/**
 * Действующее решение root по странице группы (24.1.3, R-06, D-08): одна строка на группу
 * (PK = `organization_id`). `hidden` — страница отдаёт 404, как неопубликованная; `noindex` —
 * открыта по ссылке, но закрыта от поиска, sitemap и каталога поверх `organizations.seo_index`.
 * Строки нет — решения нет. «Вернуть» удаляет строку; история решений — `audit_log`
 * (`group_page.moderation_*`, без `organization_id`, поэтому журнал группы автора не показывает).
 * Пока строка есть, владелец не меняет `seo_index`.
 */
export const groupPageModeration = pgTable(
  'group_page_moderation',
  {
    organizationId: integer('organization_id')
      .primaryKey()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    state: varchar('state', { length: 8 }).notNull(),
    reasonCode: varchar('reason_code', { length: 16 }).notNull(),
    /** «Что исправить»: видит организатор; NULL — без заметки. */
    note: varchar('note', { length: 1000 }),
    /** Кто решил (root); организатору не отдаётся. */
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('group_page_moderation_state_chk', sql`${t.state} IN ('noindex', 'hidden')`),
    check(
      'group_page_moderation_reason_chk',
      sql`${t.reasonCode} IN ('price', 'pay', 'promise', 'media', 'inactive', 'spam')`,
    ),
  ],
)

export type GroupPageModeration = typeof groupPageModeration.$inferSelect

/**
 * Жалобы посетителей на содержание публичной страницы группы (24.1.3). Жалоба доступна без
 * входа. Персональные данные минимальны: `reporter_user_id` — только если посетитель вошёл;
 * `reporter_hash` — HMAC адреса клиента для лимита 3 в сутки (сам адрес не хранится). Автор
 * жалобы виден только root и никогда — организатору.
 */
export const groupPageComplaints = pgTable(
  'group_page_complaints',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    reasonCode: varchar('reason_code', { length: 16 }).notNull(),
    details: varchar('details', { length: 500 }),
    reporterUserId: integer('reporter_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reporterHash: char('reporter_hash', { length: 64 }).notNull(),
    status: varchar('status', { length: 10 }).notNull().default('new'),
    /** `no_violation` (отклонена), `hidden` или `noindex` (решение по странице); NULL у новой. */
    resolution: varchar('resolution', { length: 16 }),
    resolvedByUserId: integer('resolved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'group_page_complaints_reason_chk',
      sql`${t.reasonCode} IN ('price', 'inactive', 'media', 'fraud', 'other')`,
    ),
    check('group_page_complaints_status_chk', sql`${t.status} IN ('new', 'rejected', 'resolved')`),
    check(
      'group_page_complaints_resolution_chk',
      sql`(${t.status} = 'new' AND ${t.resolution} IS NULL AND ${t.resolvedAt} IS NULL)
        OR (${t.status} = 'rejected' AND ${t.resolution} = 'no_violation' AND ${t.resolvedAt} IS NOT NULL)
        OR (${t.status} = 'resolved' AND ${t.resolution} IN ('hidden', 'noindex') AND ${t.resolvedAt} IS NOT NULL)`,
    ),
    index('group_page_complaints_status_created_idx').on(t.status, t.createdAt),
    index('group_page_complaints_org_idx').on(t.organizationId, t.status),
    index('group_page_complaints_reporter_created_idx').on(t.reporterHash, t.createdAt),
  ],
)

export type GroupPageComplaint = typeof groupPageComplaints.$inferSelect

/**
 * Счётчик жалоб, отсечённых лимитом 3 в сутки (KPI «Отсечено лимитом»): одна строка на сутки
 * UTC, без данных о клиенте.
 */
export const groupPageComplaintThrottle = pgTable('group_page_complaint_throttle', {
  day: date('day').primaryKey(),
  limited: integer('limited').notNull().default(0),
})
