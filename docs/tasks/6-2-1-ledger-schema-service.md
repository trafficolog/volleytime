---
id: '6.2.1'
phase: '6'
epic: '6.2'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 6.8.'
roles:
  - BACK
  - DB
depends_on:
  - '4.5.2'
estimated_hours: '2'
tags:
  - drizzle
  - schema
  - ledger
---

# Task 6.2.1: Schema ledger_entries + LedgerService (createEntry, balance)

## Цель

Таблица `ledger_entries` (income/expense, категории, трассировка) + LedgerService: createEntry, getBalance (SUM). Append-only.

## Контекст

Касса организации. Записи создаются автоматически (payment confirm → income, refund → expense) и вручную (расходы). Решение 5: type + amount + category + nullable refs + description. Решение 6: enum категорий. Решение 7: баланс через SUM.

## Что должно быть сделано

1. **`packages/db/src/schema/ledger-entries.ts`:**

   ```ts
   import {
     pgTable,
     serial,
     integer,
     text,
     timestamp,
     pgEnum,
     varchar,
     index,
   } from 'drizzle-orm/pg-core'
   import { organizations } from './organizations'
   import { users } from './users'
   import { payments } from './payments'
   import { events } from './events'

   export const ledgerTypeEnum = pgEnum('ledger_type', ['income', 'expense'])
   export const ledgerCategoryEnum = pgEnum('ledger_category', [
     'payment_income', // оплата игрока (income)
     'rent', // аренда зала (expense)
     'equipment', // инвентарь: мячи, сетки (expense)
     'refund', // возврат игроку (expense)
     'salary', // оплата тренеру/помощнику (expense)
     'other', // прочее
   ])

   export const ledgerEntries = pgTable(
     'ledger_entries',
     {
       id: serial('id').primaryKey(),
       organizationId: integer('organization_id')
         .notNull()
         .references(() => organizations.id, { onDelete: 'cascade' }),
       type: ledgerTypeEnum('type').notNull(),
       category: ledgerCategoryEnum('category').notNull(),
       amount: integer('amount').notNull(), // мин. единицы, всегда положительное (знак определяется type)
       currency: varchar('currency', { length: 8 }).notNull().default('BYN'),
       // трассировка источника
       paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
       eventId: integer('event_id').references(() => events.id, { onDelete: 'set null' }),
       description: text('description'),
       createdByUserId: integer('created_by_user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'set null' }),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       orgCreatedIdx: index('ledger_org_created_idx').on(t.organizationId, t.createdAt),
       orgTypeIdx: index('ledger_org_type_idx').on(t.organizationId, t.type),
     }),
   )

   export type LedgerEntry = typeof ledgerEntries.$inferSelect
   export type NewLedgerEntry = typeof ledgerEntries.$inferInsert
   ```

2. **Schema index + relations + миграция.**

3. **Модуль `apps/web/modules/ledger/`:**

   ```ts
   // schemas.ts
   import { z } from 'zod'
   export const CreateEntryInput = z.object({
     organizationId: z.number().int().positive(),
     type: z.enum(['income', 'expense']),
     category: z.enum(['payment_income', 'rent', 'equipment', 'refund', 'salary', 'other']),
     amount: z.number().int().positive(),
     currency: z.string().length(3).default('BYN'),
     paymentId: z.number().int().positive().optional(),
     eventId: z.number().int().positive().optional(),
     description: z.string().max(500).optional(),
   })
   export type CreateEntryInput = z.infer<typeof CreateEntryInput>
   ```

4. **`repository.ts`:**

   ```ts
   import { ledgerEntries, type LedgerEntry, type NewLedgerEntry } from '@volley-time/db'
   import { eq, and, sql } from 'drizzle-orm'

   export const ledgerRepository = {
     async create(db: DB, data: NewLedgerEntry): Promise<LedgerEntry> {
       const [e] = await db.insert(ledgerEntries).values(data).returning()
       if (!e) throw new Error('Failed to create ledger entry')
       return e
     },
     async getBalance(
       db: DB,
       orgId: number,
     ): Promise<{ income: number; expense: number; balance: number }> {
       const [row] = await db
         .select({
           income: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::int`,
           expense: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::int`,
         })
         .from(ledgerEntries)
         .where(eq(ledgerEntries.organizationId, orgId))
       const income = row?.income ?? 0
       const expense = row?.expense ?? 0
       return { income, expense, balance: income - expense }
     },
   }
   ```

5. **`service.ts`:**
   ```ts
   import { getDb, type ServiceContext } from '../shared/context'
   import { ledgerRepository } from './repository'
   import { CreateEntryInput } from './schemas'

   export const ledgerService = {
     /**
      * Создать запись. Вызывается из paymentService (income/refund) и вручную (expense).
      * Внутри транзакции при вызове из payment (ctx.db = tx).
      */
     async createEntry(ctx: ServiceContext, input: CreateEntryInput) {
       const parsed = CreateEntryInput.parse(input)
       return ledgerRepository.create(getDb(ctx), {
         ...parsed,
         createdByUserId: ctx.userId,
       })
     },

     async getBalance(ctx: ServiceContext, orgId: number) {
       return ledgerRepository.getBalance(getDb(ctx), orgId)
     },
   }
   ```

## Критерии приёмки

- ✅ Таблица ledger_entries с enums type (2) и category (6)
- ✅ amount всегда положительное (знак из type)
- ✅ Трассировка: nullable payment_id, event_id
- ✅ createEntry создаёт запись с createdByUserId
- ✅ getBalance: income/expense/balance через SUM (CASE)
- ✅ Пустая касса → balance 0 (COALESCE)
- ✅ createEntry работает в транзакции (вызов из payment confirm)
- ✅ Index (org, created_at) и (org, type)

## Подсказки

- **amount положительное, знак из type:** income +amount, expense −amount при расчёте. Хранить знак в amount — путаница. SUM с CASE по type.
- **COALESCE для пустой кассы:** SUM по нулю строк → NULL, COALESCE → 0.
- **createEntry из payment (6.1.3/6.1.4):** передаётся tx, запись атомарна с payment.
- **Append-only:** нет update/delete. Корректировка — новая запись (refund category или other).

## Не делать

- ❌ Не делать update/delete записей (append-only)
- ❌ Не хранить отрицательные amount
- ❌ Не денормализовать баланс — SUM
- ❌ Не делать мультивалютные балансы (одна валюта на org)
