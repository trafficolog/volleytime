import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

import { memberRoleEnum } from './member-enums'
import { memberStatusDefaultEnum, organizations } from './organizations'
import { users } from './users'

export const inviteTypeEnum = pgEnum('invite_type', [
  'organization_join',
  'event_join',
  'subscription_invite',
  'staff_invite',
])

export const inviteLinks = pgTable(
  'invite_links',
  {
    id: serial('id').primaryKey(),
    token: varchar('token', { length: 32 }).notNull().unique(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    eventId: integer('event_id'), // FK → events добавится в Phase 5
    type: inviteTypeEnum('type').notNull().default('organization_join'),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // enum вместо text; owner через инвайт не назначается (4.9.14)
    roleToAssign: memberRoleEnum('role_to_assign').notNull().default('player'),
    defaultMemberStatus: memberStatusDefaultEnum('default_member_status')
      .notNull()
      .default('active'),
    maxUses: integer('max_uses'), // null = безлимит
    usesCount: integer('uses_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // null = бессрочно
    isRevoked: boolean('is_revoked').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('invite_links_org_idx').on(t.organizationId),
    index('invite_links_active_idx').on(t.isRevoked),
    check('invite_links_role_not_owner', sql`${t.roleToAssign} <> 'owner'`),
    check('invite_links_uses_non_negative', sql`${t.usesCount} >= 0`),
  ],
)

export type InviteLink = typeof inviteLinks.$inferSelect
export type NewInviteLink = typeof inviteLinks.$inferInsert
