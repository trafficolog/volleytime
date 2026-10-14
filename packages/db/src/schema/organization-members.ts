import { index, integer, pgTable, serial, timestamp, unique } from 'drizzle-orm/pg-core'

import { inviteLinks } from './invite-links'
import { playerLevelEnum } from './level-enums'
import { memberRoleEnum, memberStatusEnum } from './member-enums'
import { organizations } from './organizations'
import { playerLevels } from './player-levels'
import { users } from './users'

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('player'),
    status: memberStatusEnum('status').notNull().default('active'),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    invitedByUserId: integer('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    inviteId: integer('invite_id').references(() => inviteLinks.id, { onDelete: 'set null' }), // FK (4.9.14)
    // не читается и не пишется кодом; удаление — contract-шаг не раньше v0.3.0 (ADR v3)
    ratingInOrg: integer('rating_in_org'),
    // уровень игрока в этой группе (19.2.3); NULL — не назначен
    level: playerLevelEnum('level').references(() => playerLevels.code, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('org_members_org_user_unique').on(t.organizationId, t.userId),
    index('org_members_org_idx').on(t.organizationId),
    index('org_members_user_idx').on(t.userId),
    index('org_members_role_idx').on(t.organizationId, t.role),
  ],
)

export type OrganizationMember = typeof organizationMembers.$inferSelect
export type NewOrganizationMember = typeof organizationMembers.$inferInsert
