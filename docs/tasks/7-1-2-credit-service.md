---
id: '7.1.2'
phase: '7'
epic: '7.1'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
depends_on:
  - '7.1.1'
estimated_hours: '1-2'
tags:
  - service
  - credits
---

# Task 7.1.2: CreditService (balance, addTransaction)

## Цель

CreditService: getBalance, addTransaction (атомарно меняет баланс + пишет транзакцию), getOrCreateAccount. Защита от отрицательного баланса.

## Контекст

Ядро credits. addTransaction — единая точка изменения баланса (все операции через неё: grant/spend/refund/purchase). Атомарно: обновить account.balance + создать transaction с balanceAfter.

## Что должно быть сделано

1. **Модуль `apps/web/modules/credits/`** (service, repository, errors, index).

2. **`errors.ts`:**

   ```ts
   export class CreditError extends Error {
     code: string
     constructor(code: string, message: string) {
       super(message)
       this.code = code
       this.name = 'CreditError'
     }
   }
   export class InsufficientCreditsError extends CreditError {
     constructor() {
       super('credits.insufficient', 'Недостаточно credits. Купите пакет, чтобы создавать события.')
     }
   }
   ```

3. **`service.ts`:**

   ```ts
   import { getDb, type ServiceContext } from '../shared/context'
   import { eventCreditAccounts, eventCreditTransactions } from '@volley-time/db'
   import { eq } from 'drizzle-orm'
   import { InsufficientCreditsError } from './errors'

   type CreditTxType = 'demo_grant' | 'admin_grant' | 'purchase' | 'spend' | 'refund'

   export const creditService = {
     async getOrCreateAccount(ctx: ServiceContext, orgId: number) {
       const db = getDb(ctx)
       let acc = await db.query.eventCreditAccounts.findFirst({
         where: eq(eventCreditAccounts.organizationId, orgId),
       })
       if (!acc) {
         ;[acc] = await db
           .insert(eventCreditAccounts)
           .values({ organizationId: orgId, balance: 0 })
           .returning()
       }
       return acc!
     },

     async getBalance(ctx: ServiceContext, orgId: number): Promise<number> {
       const acc = await this.getOrCreateAccount(ctx, orgId)
       return acc.balance
     },

     /**
      * Единая точка изменения баланса. Атомарно: account.balance += amount + transaction.
      * amount: + для grant/purchase/refund, − для spend.
      * Защита: баланс не уходит в отрицательный (spend при недостатке → InsufficientCreditsError).
      * Вызывать внутри транзакции вызывающего (ctx.db = tx) для атомарности с Event и т.д.
      */
     async addTransaction(
       ctx: ServiceContext,
       params: {
         organizationId: number
         type: CreditTxType
         amount: number
         eventId?: number
         priceAmount?: number
         note?: string
       },
     ) {
       const db = getDb(ctx)
       const acc = await this.getOrCreateAccount(ctx, params.organizationId)
       const newBalance = acc.balance + params.amount

       if (newBalance < 0) {
         throw new InsufficientCreditsError()
       }

       // обновить баланс
       await db
         .update(eventCreditAccounts)
         .set({ balance: newBalance, updatedAt: new Date() })
         .where(eq(eventCreditAccounts.id, acc.id))

       // записать транзакцию
       const [tx] = await db
         .insert(eventCreditTransactions)
         .values({
           organizationId: params.organizationId,
           type: params.type,
           amount: params.amount,
           balanceAfter: newBalance,
           eventId: params.eventId ?? null,
           priceAmount: params.priceAmount ?? null,
           note: params.note ?? null,
           createdByUserId: ctx.userId ?? null,
         })
         .returning()

       return { transaction: tx!, balance: newBalance }
     },

     async listTransactions(ctx: ServiceContext, orgId: number, limit = 50, offset = 0) {
       const db = getDb(ctx)
       return db.query.eventCreditTransactions.findMany({
         where: eq(eventCreditTransactions.organizationId, orgId),
         orderBy: (t, { desc }) => [desc(t.createdAt)],
         limit,
         offset,
       })
     },
   }
   ```

4. **Тесты:**
   ```ts
   test('getOrCreateAccount creates account with 0 balance', async () => {})
   test('addTransaction grant increases balance + records tx', async () => {})
   test('addTransaction spend decreases balance', async () => {})
   test('addTransaction spend below 0 → InsufficientCreditsError', async () => {})
   test('balanceAfter matches new balance', async () => {})
   test('transaction records type/amount/eventId/note', async () => {})
   ```

## Критерии приёмки

- ✅ getOrCreateAccount (создаёт с balance 0)
- ✅ getBalance возвращает текущий баланс
- ✅ addTransaction: атомарно balance += amount + transaction с balanceAfter
- ✅ spend ниже 0 → InsufficientCreditsError (баланс не уходит в минус)
- ✅ listTransactions (история, desc, pagination)
- ✅ Работает в транзакции вызывающего (ctx.db = tx)
- ✅ Тесты

## Подсказки

- **addTransaction — единая точка** изменения баланса. Все операции (demo/admin grant, purchase, spend, refund) через неё. Гарантирует balance_after консистентность.
- **Атомарность через ctx.db = tx** — когда вызывается из eventService.create (spend), передаётся tx, credit и Event атомарны.
- **Защита от минуса в addTransaction** — единственное место проверки, spend не уйдёт в отрицательный. InsufficientCreditsError ловится в eventService → UI.
- **balanceAfter** — снимок баланса для audit и сверки (7.8: SUM(amount) == balance).

## Не делать

- ❌ Не менять баланс мимо addTransaction (рассинхрон)
- ❌ Не допускать отрицательный баланс
- ❌ Не делать UI — эпик 7.6
