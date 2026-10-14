import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import { events } from './events'
import { organizations } from './organizations'
import { users } from './users'

/**
 * Баланс событий (20.2.1, ADR v3 «Баланс событий», D-09, D-10, D-12, D-13).
 * 1 событие = 1 единица. Журнал append-only; проекция — для блокировки и быстрого чтения.
 */
export const EVENT_BALANCE_REASONS = [
  'demo_grant',
  'pilot_grant',
  'purchase',
  'grant',
  'spend',
  'refund',
  'correction',
] as const
export type EventBalanceReason = (typeof EVENT_BALANCE_REASONS)[number]
export const eventBalanceReasonEnum = pgEnum('event_balance_reason', EVENT_BALANCE_REASONS)

export const EVENT_BALANCE_ACTORS = ['user', 'system'] as const
export type EventBalanceActor = (typeof EVENT_BALANCE_ACTORS)[number]
export const eventBalanceActorEnum = pgEnum('event_balance_actor', EVENT_BALANCE_ACTORS)

export const PURCHASE_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type PurchaseRequestStatus = (typeof PURCHASE_REQUEST_STATUSES)[number]
export const purchaseRequestStatusEnum = pgEnum(
  'purchase_request_status',
  PURCHASE_REQUEST_STATUSES,
)

/** Проекция журнала: одна строка на организацию, блокируется FOR UPDATE при каждом изменении. */
export const organizationEventBalances = pgTable(
  'organization_event_balances',
  {
    organizationId: integer('organization_id')
      .primaryKey()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    balance: integer('balance').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('organization_event_balances_non_negative', sql`${t.balance} >= 0`)],
)

/** Заявка организатора на покупку пакета (D-07: без онлайн-оплаты, подтверждает root). */
export const eventBalancePurchaseRequests = pgTable(
  'event_balance_purchase_requests',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requestedByUserId: integer('requested_by_user_id')
      .notNull()
      .references(() => users.id),
    // снимок пакета и цены: смена каталога не меняет старые заявки
    units: integer('units').notNull(),
    amount: integer('amount').notNull(), // minor units
    currency: varchar('currency', { length: 8 }).notNull(),
    status: purchaseRequestStatusEnum('status').notNull().default('pending'),
    decidedByUserId: integer('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionComment: text('decision_comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('event_balance_purchase_requests_org_idx').on(t.organizationId, t.createdAt),
    check('event_balance_purchase_requests_units_positive', sql`${t.units} > 0`),
    check('event_balance_purchase_requests_amount_non_negative', sql`${t.amount} >= 0`),
    check(
      'event_balance_purchase_requests_decision',
      sql`(${t.status} = 'pending') = (${t.decidedAt} IS NULL)`,
    ),
  ],
)

/** Журнал операций баланса: append-only, исправление — новой строкой `correction`. */
export const eventBalanceEntries = pgTable(
  'event_balance_entries',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: eventBalanceReasonEnum('reason').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    eventId: integer('event_id').references(() => events.id, { onDelete: 'set null' }),
    purchaseRequestId: integer('purchase_request_id').references(
      () => eventBalancePurchaseRequests.id,
    ),
    actorKind: eventBalanceActorEnum('actor_kind').notNull(),
    createdByUserId: integer('created_by_user_id').references(() => users.id),
    source: text('source'),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('event_balance_entries_org_created_idx').on(t.organizationId, t.createdAt, t.id),
    index('event_balance_entries_event_idx').on(t.eventId),
    // последняя линия защиты; идемпотентность — проверкой под блокировкой проекции (ADR)
    uniqueIndex('event_balance_spend_event_uniq')
      .on(t.eventId)
      .where(sql`${t.reason} = 'spend'`),
    uniqueIndex('event_balance_refund_event_uniq')
      .on(t.eventId)
      .where(sql`${t.reason} = 'refund'`),
    uniqueIndex('event_balance_demo_grant_org_uniq')
      .on(t.organizationId)
      .where(sql`${t.reason} = 'demo_grant'`),
    uniqueIndex('event_balance_pilot_grant_org_uniq')
      .on(t.organizationId)
      .where(sql`${t.reason} = 'pilot_grant'`),
    uniqueIndex('event_balance_purchase_request_uniq')
      .on(t.purchaseRequestId)
      .where(sql`${t.reason} = 'purchase'`),
    check('event_balance_entries_delta_non_zero', sql`${t.delta} <> 0`),
    check('event_balance_entries_balance_after_non_negative', sql`${t.balanceAfter} >= 0`),
    // списание — минус, начисления — плюс, исправление — любой знак
    check(
      'event_balance_entries_delta_sign',
      sql`(${t.reason} = 'spend' AND ${t.delta} < 0) OR ${t.reason} = 'correction' OR (${t.reason} NOT IN ('spend', 'correction') AND ${t.delta} > 0)`,
    ),
    check(
      'event_balance_entries_actor_user',
      sql`(${t.actorKind} = 'user') = (${t.createdByUserId} IS NOT NULL)`,
    ),
    check(
      'event_balance_entries_system_source',
      sql`${t.actorKind} <> 'system' OR ${t.source} IS NOT NULL`,
    ),
    check(
      'event_balance_entries_comment_required',
      sql`(${t.actorKind} <> 'system' AND ${t.reason} NOT IN ('grant', 'correction')) OR ${t.comment} IS NOT NULL`,
    ),
    check(
      'event_balance_entries_purchase_request',
      sql`(${t.reason} = 'purchase') = (${t.purchaseRequestId} IS NOT NULL)`,
    ),
  ],
)

export type OrganizationEventBalance = typeof organizationEventBalances.$inferSelect
export type EventBalanceEntry = typeof eventBalanceEntries.$inferSelect
export type NewEventBalanceEntry = typeof eventBalanceEntries.$inferInsert
export type EventBalancePurchaseRequest = typeof eventBalancePurchaseRequests.$inferSelect
