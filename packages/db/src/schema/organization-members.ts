import { index, integer, pgTable, serial, timestamp, unique } from 'drizzle-orm/pg-core'

import { inviteLinks } from './invite-links'
import { memberRoleEnum, memberStatusEnum } from './member-enums'

import { organizations } from './organizations'
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
    ratingInOrg: integer('rating_in_org'),
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
