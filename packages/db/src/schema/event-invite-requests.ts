import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { events } from './events'
import { inviteLinks } from './invite-links'
import { organizations } from './organizations'
import { users } from './users'

export const inviteRequestStatusEnum = pgEnum('invite_request_status', [
  'pending',
  'approved',
  'declined',
  'cancelled',
])

/**
 * Запрос приглашения на событие `invite` от игрока (20.1.3, ADR v3). Одобрение выдаёт
 * однократное приглашение `invite_links` (`type = 'event_join'`) — `invite_id`.
 */
export const eventInviteRequests = pgTable(
  'event_invite_requests',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: inviteRequestStatusEnum('status').notNull().default('pending'),
    message: text('message'),
    decidedByUserId: integer('decided_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    inviteId: integer('invite_id').references(() => inviteLinks.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('event_invite_requests_pending_unique')
      .on(t.eventId, t.userId)
      .where(sql`${t.status} = 'pending'`),
    index('event_invite_requests_event_status_idx').on(t.eventId, t.status),
    index('event_invite_requests_user_idx').on(t.userId),
  ],
)

export type EventInviteRequest = typeof eventInviteRequests.$inferSelect
