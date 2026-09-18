---
id: '7.5.1'
phase: '7'
epic: '7.5'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
depends_on:
  - '7.1.2'
  - '7.4.1'
estimated_hours: '2'
tags:
  - credits
  - purchase
  - service
---

# Task 7.5.1: PurchaseRequest schema + service (create, confirm, reject)

## Цель

Таблица credit_purchase_requests (заявки). Сервис: создать заявку (организатор), подтвердить (root → grant credits), отклонить.

## Контекст

Решение 5: ручное подтверждение в Phase 7. Заявка фиксирует намерение (количество + сумма по сетке). Root-admin подтверждает после оплаты → credits начислены. Online — Phase 12.

## Что должно быть сделано

1. **`packages/db/src/schema/credit-purchase-requests.ts`:**

   ```ts
   import { pgTable, serial, integer, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
   import { organizations } from './organizations'
   import { users } from './users'

   export const purchaseRequestStatusEnum = pgEnum('purchase_request_status', [
     'pending',
     'confirmed',
     'rejected',
   ])

   export const creditPurchaseRequests = pgTable('credit_purchase_requests', {
     id: serial('id').primaryKey(),
     organizationId: integer('organization_id')
       .notNull()
       .references(() => organizations.id, { onDelete: 'cascade' }),
     quantity: integer('quantity').notNull(),
     priceAmount: integer('price_amount').notNull(), // сумма по сетке на момент заявки (minor)
     pricePerCredit: integer('price_per_credit').notNull(), // зафиксированная цена/кредит
     status: purchaseRequestStatusEnum('status').notNull().default('pending'),
     requestedByUserId: integer('requested_by_user_id')
       .notNull()
       .references(() => users.id),
     processedByUserId: integer('processed_by_user_id').references(() => users.id), // root-admin
     processedAt: timestamp('processed_at', { withTimezone: true }),
     note: text('note'), // причина отклонения / комментарий
     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   })

   export type CreditPurchaseRequest = typeof creditPurchaseRequests.$inferSelect
   ```

2. **purchaseService `modules/credits/purchase.ts`:**

   ```ts
   export const purchaseService = {
     /**
      * Организатор создаёт заявку. Цена фиксируется по сетке на момент заявки.
      */
     async createRequest(ctx: ServiceContext, orgId: number, quantity: number) {
       const quote = await calculatePrice(quantity) // 7.4.1
       const [req] = await getDb(ctx)
         .insert(creditPurchaseRequests)
         .values({
           organizationId: orgId,
           quantity,
           priceAmount: quote.total,
           pricePerCredit: quote.pricePerCredit,
           status: 'pending',
           requestedByUserId: ctx.userId,
         })
         .returning()
       return req!
     },

     /**
      * Root-admin подтверждает (после получения оплаты) → grant credits.
      */
     async confirmRequest(ctx: ServiceContext, requestId: number) {
       const db = getDb(ctx)
       return await db.transaction(async (tx) => {
         const req = await tx.query.creditPurchaseRequests.findFirst({
           where: eq(creditPurchaseRequests.id, requestId),
         })
         if (!req) throw new CreditError('credits.request_not_found', 'Заявка не найдена')
         if (req.status !== 'pending')
           throw new CreditError('credits.request_not_pending', 'Заявка уже обработана')

         // grant credits (purchase transaction)
         await creditService.addTransaction(
           { ...ctx, db: tx },
           {
             organizationId: req.organizationId,
             type: 'purchase',
             amount: req.quantity,
             priceAmount: req.priceAmount,
             note: `Покупка ${req.quantity} credits (заявка #${req.id})`,
           },
         )

         const [updated] = await tx
           .update(creditPurchaseRequests)
           .set({
             status: 'confirmed',
             processedByUserId: ctx.userId,
             processedAt: new Date(),
           })
           .where(eq(creditPurchaseRequests.id, requestId))
           .returning()
         return updated!
       })
     },

     async rejectRequest(ctx: ServiceContext, requestId: number, reason?: string) {
       // pending → rejected, без grant
     },

     async listPending(ctx: ServiceContext) {
       return getDb(ctx).query.creditPurchaseRequests.findMany({
         where: eq(creditPurchaseRequests.status, 'pending'),
         with: { organization: true },
         orderBy: (r, { asc }) => [asc(r.createdAt)],
       })
     },

     async listForOrg(ctx: ServiceContext, orgId: number) {
       // история заявок организации
     },
   }
   ```

3. **Идемпотентность confirm:** не-pending → request_not_pending (повторный confirm не дублирует grant).

4. **Цена фиксируется на момент заявки** — если root меняет сетку между заявкой и подтверждением, действует цена заявки (priceAmount/pricePerCredit сохранены).

5. **Тесты:**
   ```ts
   test('createRequest fixes price from grid', async () => {})
   test('confirmRequest grants credits + marks confirmed', async () => {})
   test('confirm non-pending → request_not_pending', async () => {})
   test('reject → rejected, no grant', async () => {})
   test('confirmed request grants exact quantity', async () => {})
   test('price fixed at request time (grid change after does not affect)', async () => {})
   ```

## Критерии приёмки

- ✅ credit_purchase_requests (quantity, priceAmount, pricePerCredit, status)
- ✅ createRequest: фиксирует цену по сетке (7.4.1)
- ✅ confirmRequest: grant credits (purchase tx) + confirmed, атомарно
- ✅ rejectRequest: rejected, без grant
- ✅ Идемпотентность (не-pending → ошибка)
- ✅ listPending (для root-admin), listForOrg (история)
- ✅ Цена фиксирована на момент заявки
- ✅ Тесты

## Подсказки

- **Цена фиксируется при создании заявки** — priceAmount/pricePerCredit сохраняются. Если root меняет сетку до подтверждения — действует цена заявки (честно к организатору, согласовали эту сумму).
- **confirm атомарно** — grant credits + статус confirmed в одной транзакции. Сбой → ничего.
- **Идемпотентность** — повторный confirm pending-заявки невозможен (статус проверяется). Защита от двойного grant.
- **purchase transaction (7.1)** — фиксирует количество + priceAmount. Это и есть «платформенный учёт» (решение 6), без отдельного ledger.

## Не делать

- ❌ Не начислять до подтверждения
- ❌ Не дублировать grant (идемпотентность)
- ❌ Не пересчитывать цену при подтверждении (фиксирована)
- ❌ Не вести платформенный ledger (transaction достаточно)
