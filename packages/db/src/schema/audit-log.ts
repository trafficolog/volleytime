import { index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { users } from './users'

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }), // actor
    action: text('action').notNull(), // 'organization.created', 'member.blocked', ...
    entityType: text('entity_type').notNull(), // 'organization' | 'member' | 'invite'
    entityId: integer('entity_id').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_org_created_idx').on(t.organizationId, t.createdAt),
    index('audit_log_action_idx').on(t.action),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
  ],
)

export type AuditLogEntry = typeof auditLog.$inferSelect
export type NewAuditLogEntry = typeof auditLog.$inferInsert
