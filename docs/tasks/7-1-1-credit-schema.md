---
id: '7.1.1'
phase: '7'
epic: '7.1'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
  - DB
depends_on:
  - '4.1'
estimated_hours: '1-2'
tags:
  - drizzle
  - schema
  - credits
---

# Task 7.1.1: Schema account + transaction + миграция

## Цель

Таблицы event_credit_accounts (баланс организации) и event_credit_transactions (журнал, append-only). Миграция.

## Контекст

Основа credits. Account — баланс per org. Transaction — каждое движение (demo_grant/admin_grant/purchase/spend/refund). Append-only как Payment/Ledger (Phase 6). Баланс денормализован в account + сверяется с SUM транзакций.

## Что должно быть сделано

1. **`packages/db/src/schema/event-credit-accounts.ts`:**

   ```ts
   import { pgTable, serial, integer, timestamp } from 'drizzle-orm/pg-core'
   import { organizations } from './organizations'

   export const eventCreditAccounts = pgTable('event_credit_accounts', {
     id: serial('id').primaryKey(),
     organizationId: integer('organization_id')
       .notNull()
       .unique()
       .references(() => organizations.id, { onDelete: 'cascade' }),
     balance: integer('balance').notNull().default(0), // текущий баланс (денормализован)
     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
     updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   })

   export type EventCreditAccount = typeof eventCreditAccounts.$inferSelect
   ```

2. **`packages/db/src/schema/event-credit-transactions.ts`:**

   ```ts
   import { pgTable, serial, integer, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
   import { organizations } from './organizations'
   import { users } from './users'
   import { events } from './events'

   export const creditTxTypeEnum = pgEnum('credit_tx_type', [
     'demo_grant', // 5 credits новой org
     'admin_grant', // ручной grant root-админом
     'purchase', // покупка (подтверждённая заявка)
     'spend', // создание Event (−1)
     'refund', // отмена Event до открытия записи (+1)
   ])

   export const eventCreditTransactions = pgTable(
     'event_credit_transactions',
     {
       id: serial('id').primaryKey(),
       organizationId: integer('organization_id')
         .notNull()
         .references(() => organizations.id, { onDelete: 'cascade' }),
       type: creditTxTypeEnum('type').notNull(),
       amount: integer('amount').notNull(), // ± (grant/purchase/refund +, spend −)
       balanceAfter: integer('balance_after').notNull(), // баланс после операции (audit)
       // трассировка
       eventId: integer('event_id').references(() => events.id, { onDelete: 'set null' }), // для spend/refund
       priceAmount: integer('price_amount'), // для purchase — сумма оплаты (minor)
       note: text('note'), // для admin_grant и т.д.
       createdByUserId: integer('created_by_user_id').references(() => users.id, {
         onDelete: 'set null',
       }),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       orgIdx: index('credit_tx_org_idx').on(t.organizationId, t.createdAt),
     }),
   )

   export type EventCreditTransaction = typeof eventCreditTransactions.$inferSelect
   ```

3. **Relations + index + миграция.**

4. **Проверки:**
   - balance в account integer (может быть 0, не отрицательный — enforced в сервисе)
   - amount signed (spend отрицательный, grant/refund/purchase положительный)
   - balanceAfter фиксирует баланс на момент (audit-трейл)
   - eventId для spend/refund (какое событие), priceAmount для purchase

## Критерии приёмки

- ✅ event_credit_accounts (organization unique, balance)
- ✅ event_credit_transactions (type enum 5, amount ±, balance_after, трассировка)
- ✅ Типы: demo_grant, admin_grant, purchase, spend, refund
- ✅ eventId (spend/refund), priceAmount (purchase), note
- ✅ FK cascade/set null
- ✅ Index (org, created_at)
- ✅ Миграция применяется

## Подсказки

- **balance денормализован + balance_after в транзакции** — двойная защита. Баланс быстро читается из account, balance_after даёт audit-трейл и позволяет сверку (7.8 инвариант balance == SUM amounts).
- **amount signed** — spend = −1, grant/refund/purchase = +N. SUM(amount) == balance.
- **priceAmount только для purchase** — сколько заплатили (minor units, как Payment). Для grant/spend/refund — null.
- **eventId для spend/refund** — связь с событием (за что списали/вернули). Audit.
- **Не отрицательный баланс** — enforce в сервисе (7.1.2), не на уровне схемы (integer допускает, но логика не даёт уйти в минус).

## Не делать

- ❌ Не допускать отрицательный баланс (сервис проверяет)
- ❌ Не редактировать транзакции (append-only)
- ❌ Не хранить цены как float (integer minor)
