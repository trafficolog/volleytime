import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { users } from './users'

/**
 * Состояние привязки Telegram-чата к группе (20.3.4): `active` — бот в чате и может писать;
 * `invalid` — бот лишён права писать (`no_rights`, привязка оживает, когда право вернули) или чат
 * перенесён в супергруппу (`migrated`); привязка не удаляется молча: организатор видит причину;
 * `unlinked` — привязка снята: организатором или исключением бота из чата (`unlink_reason`), строка
 * остаётся историей и не занимает ни чат, ни группу. Возвращение бота привязку не оживляет.
 */
export const telegramChatLinkStatusEnum = pgEnum('telegram_chat_link_status', [
  'active',
  'invalid',
  'unlinked',
])

/**
 * Привязка группового Telegram-чата к группе. Один чат — одна группа, одна группа — не более одного
 * не отвязанного чата: уникальность на уровне БД частичными индексами по `status <> 'unlinked'`.
 * `confirmed_by_telegram_id` — администратор чата (creator/administrator по `getChatMember`),
 * отправивший код; наружу API его не отдаёт. `linked_by_user_id` — организатор, выдавший код.
 */
export const organizationTelegramChats = pgTable(
  'organization_telegram_chats',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    telegramChatId: bigint('telegram_chat_id', { mode: 'bigint' }).notNull(),
    chatType: text('chat_type').notNull(),
    title: text('title').notNull(),
    status: telegramChatLinkStatusEnum('status').notNull().default('active'),
    invalidReason: text('invalid_reason'),
    unlinkReason: text('unlink_reason'),
    botCanPost: boolean('bot_can_post').notNull().default(true),
    linkedByUserId: integer('linked_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    confirmedByTelegramId: bigint('confirmed_by_telegram_id', { mode: 'bigint' }).notNull(),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    permissionsCheckedAt: timestamp('permissions_checked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull().defaultNow(),
    unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
    unlinkedByUserId: integer('unlinked_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    uniqueIndex('org_telegram_chats_chat_uniq')
      .on(t.telegramChatId)
      .where(sql`${t.status} <> 'unlinked'`),
    uniqueIndex('org_telegram_chats_org_uniq')
      .on(t.organizationId)
      .where(sql`${t.status} <> 'unlinked'`),
    check('org_telegram_chats_chat_type_chk', sql`${t.chatType} IN ('group', 'supergroup')`),
    check(
      'org_telegram_chats_invalid_reason_chk',
      sql`(${t.status} = 'invalid') = (${t.invalidReason} IS NOT NULL)
        AND (${t.invalidReason} IS NULL OR ${t.invalidReason} IN ('no_rights', 'migrated'))`,
    ),
    check(
      'org_telegram_chats_unlink_reason_chk',
      sql`(${t.status} = 'unlinked') = (${t.unlinkReason} IS NOT NULL)
        AND (${t.unlinkReason} IS NULL OR ${t.unlinkReason} IN ('organizer', 'bot_removed'))`,
    ),
  ],
)

/**
 * Одноразовый код привязки чата, выданный организатором в кабинете. Хранится только SHA-256 кода
 * (код ~40 бит случайности, срок действия — минуты); `consumed_at` ставится условным UPDATE, поэтому
 * код срабатывает ровно один раз при любой конкуренции.
 */
export const telegramChatLinkCodes = pgTable(
  'telegram_chat_link_codes',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('telegram_chat_link_codes_hash_uniq').on(t.codeHash),
    index('telegram_chat_link_codes_org_idx').on(t.organizationId),
  ],
)

export type OrganizationTelegramChat = typeof organizationTelegramChats.$inferSelect
export type TelegramChatLinkCode = typeof telegramChatLinkCodes.$inferSelect
