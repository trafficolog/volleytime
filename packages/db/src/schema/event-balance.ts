import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
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

/**
 * Каталог пакетов баланса событий (22.2.1, ADR-22-2-1, D-18). `code`, `units` и `currency` не
 * меняются после создания; цена, бейдж, видимость и порядок правятся с оптимистичной блокировкой
 * по `version`. Архив (`archived_at`) — «Удалить»; жёсткого удаления нет.
 */
export const EVENT_BALANCE_PACKAGE_BADGES = ['popular', 'discount', 'best_price'] as const
export type EventBalancePackageBadge = (typeof EVENT_BALANCE_PACKAGE_BADGES)[number]

export const eventBalancePackages = pgTable(
  'event_balance_packages',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    units: integer('units').notNull(),
    amount: integer('amount').notNull(), // minor units
    currency: varchar('currency', { length: 8 }).notNull().default('BYN'),
    badge: text('badge').$type<EventBalancePackageBadge>(),
    visible: boolean('visible').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('event_balance_packages_units_currency_active')
      .on(t.units, t.currency)
      .where(sql`${t.archivedAt} IS NULL`),
    check('event_balance_packages_code_format', sql`${t.code} ~ '^[a-z0-9_]{1,64}$'`),
    check('event_balance_packages_units_positive', sql`${t.units} > 0`),
    check('event_balance_packages_amount_non_negative', sql`${t.amount} >= 0`),
    check(
      'event_balance_packages_badge',
      sql`${t.badge} IS NULL OR ${t.badge} IN ('popular', 'discount', 'best_price')`,
    ),
    check(
      'event_balance_packages_archived_hidden',
      sql`${t.archivedAt} IS NULL OR NOT ${t.visible}`,
    ),
  ],
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
    // атрибуция продаж (22.2.1): источник истины заявки — снимок выше, а не пакет
    packageId: integer('package_id'),
    status: purchaseRequestStatusEnum('status').notNull().default('pending'),
    decidedByUserId: integer('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionComment: text('decision_comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('event_balance_purchase_requests_org_idx').on(t.organizationId, t.createdAt),
    index('event_balance_purchase_requests_package_idx').on(t.packageId),
    // имя короче 63 символов: автоимя drizzle Postgres усекает
    foreignKey({
      name: 'event_balance_requests_package_id_fk',
      columns: [t.packageId],
      foreignColumns: [eventBalancePackages.id],
    }).onDelete('restrict'),
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
export type EventBalancePackage = typeof eventBalancePackages.$inferSelect
export type EventBalancePurchaseRequest = typeof eventBalancePurchaseRequests.$inferSelect
