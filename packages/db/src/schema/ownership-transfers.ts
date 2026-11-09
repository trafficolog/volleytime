import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { users } from './users'

/**
 * Передача владения группой (21.2.17, D-15). Owner начинает передачу участнику группы; получатель
 * принимает её по личной ссылке. Токен ссылки хранится только хешем (SHA-256, hex): одноразовый,
 * с истекающим сроком, привязан к получателю. Не больше одной ожидающей передачи на группу —
 * частичный уникальный индекс. Строки не удаляются: это история, дублируемая в `audit_log`.
 */
export const organizationOwnershipTransfers = pgTable(
  'organization_ownership_transfers',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fromUserId: integer('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toUserId: integer('to_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    // pending → accepted | cancelled | expired; переходы — условным UPDATE из `pending`
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('org_ownership_transfers_token_uniq').on(t.tokenHash),
    uniqueIndex('org_ownership_transfers_pending_uniq')
      .on(t.organizationId)
      .where(sql`${t.status} = 'pending'`),
    index('org_ownership_transfers_org_idx').on(t.organizationId, t.createdAt),
    check(
      'org_ownership_transfers_status_chk',
      sql`${t.status} IN ('pending', 'accepted', 'cancelled', 'expired')`,
    ),
    check(
      'org_ownership_transfers_resolved_chk',
      sql`(${t.status} = 'pending') = (${t.resolvedAt} IS NULL)`,
    ),
    check('org_ownership_transfers_self_chk', sql`${t.fromUserId} <> ${t.toUserId}`),
    check('org_ownership_transfers_token_chk', sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check('org_ownership_transfers_expiry_chk', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
)

export type OrganizationOwnershipTransfer = typeof organizationOwnershipTransfers.$inferSelect
export type NewOrganizationOwnershipTransfer = typeof organizationOwnershipTransfers.$inferInsert
