---
id: '6.2.2'
phase: '6'
epic: '6.2'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '6.2.1'
estimated_hours: '1-2'
tags:
  - service
  - ledger
---

# Task 6.2.2: History с фильтрами + addExpense

## Цель

LedgerService: listHistory (фильтры type/category/дата, pagination), addExpense (ручной расход организатором).

## Контекст

Организатор смотрит историю кассы и вводит расходы (аренда, мячи). addExpense — обёртка над createEntry с type=expense и permission-проверкой на уровне API (6.2.3).

## Что должно быть сделано

1. **`repository.ts` — listHistory:**

   ```ts
   import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

   async listHistory(db: DB, orgId: number, opts: {
     type?: 'income' | 'expense'
     category?: string
     dateFrom?: Date
     dateTo?: Date
     limit: number
     offset: number
   }): Promise<{ entries: LedgerEntry[]; total: number }> {
     const conditions = [eq(ledgerEntries.organizationId, orgId)]
     if (opts.type) conditions.push(eq(ledgerEntries.type, opts.type))
     if (opts.category) conditions.push(eq(ledgerEntries.category, opts.category as any))
     if (opts.dateFrom) conditions.push(gte(ledgerEntries.createdAt, opts.dateFrom))
     if (opts.dateTo) conditions.push(lte(ledgerEntries.createdAt, opts.dateTo))
     const where = and(...conditions)

     const [entries, totalRows] = await Promise.all([
       db.query.ledgerEntries.findMany({
         where, orderBy: [desc(ledgerEntries.createdAt)],
         limit: opts.limit, offset: opts.offset,
       }),
       db.select({ count: sql<number>`count(*)::int` }).from(ledgerEntries).where(where),
     ])
     return { entries, total: totalRows[0]?.count ?? 0 }
   }
   ```

2. **`service.ts` — listHistory + addExpense:**

   ```ts
   import { ListHistoryQuery } from './schemas'

   async listHistory(ctx: ServiceContext, orgId: number, query: ListHistoryQuery) {
     const parsed = ListHistoryQuery.parse(query)
     return ledgerRepository.listHistory(getDb(ctx), orgId, parsed)
   },

   /**
    * Ручной расход организатором (rent/equipment/salary/other).
    * Permission проверяется на API уровне (6.2.3).
    */
   async addExpense(ctx: ServiceContext, orgId: number, input: {
     category: 'rent' | 'equipment' | 'salary' | 'other'
     amount: number
     currency?: string
     description?: string
   }) {
     return this.createEntry(ctx, {
       organizationId: orgId,
       type: 'expense',
       category: input.category,
       amount: input.amount,
       currency: input.currency ?? 'BYN',
       description: input.description,
     })
   },
   ```

3. **`schemas.ts` — добавить:**
   ```ts
   export const ListHistoryQuery = z.object({
     type: z.enum(['income', 'expense']).optional(),
     category: z
       .enum(['payment_income', 'rent', 'equipment', 'refund', 'salary', 'other'])
       .optional(),
     dateFrom: z.coerce.date().optional(),
     dateTo: z.coerce.date().optional(),
     limit: z.coerce.number().int().min(1).max(200).default(50),
     offset: z.coerce.number().int().min(0).default(0),
   })
   export type ListHistoryQuery = z.infer<typeof ListHistoryQuery>

   export const AddExpenseInput = z.object({
     category: z.enum(['rent', 'equipment', 'salary', 'other']),
     amount: z.number().int().positive(),
     currency: z.string().length(3).default('BYN'),
     description: z.string().max(500).optional(),
   })
   ```

## Критерии приёмки

- ✅ listHistory с фильтрами type/category/dateFrom/dateTo
- ✅ Сортировка desc по createdAt (новые первыми)
- ✅ Pagination (limit max 200, offset)
- ✅ Возвращает entries + total
- ✅ addExpense создаёт expense запись (category из rent/equipment/salary/other)
- ✅ addExpense НЕ позволяет category payment_income/refund (только ручные расходы)
- ✅ amount положительное

## Подсказки

- **addExpense ограничивает категории:** payment_income и refund создаются автоматически (payment confirm/refund), вручную их вводить нельзя. Zod enum в AddExpenseInput только rent/equipment/salary/other.
- **listHistory desc** — лента операций, последние сверху.
- **Permission** — на API (6.2.3): только owner/organizer добавляют расходы и видят кассу.

## Не делать

- ❌ Не позволять ручной payment_income (только через payment confirm)
- ❌ Не позволять ручной refund expense (только через paymentService.refund)
- ❌ Не делать редактирование/удаление
- ❌ Не делать экспорт — Phase 14
