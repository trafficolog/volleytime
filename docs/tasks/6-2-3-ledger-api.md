---
id: '6.2.3'
phase: '6'
epic: '6.2'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 6.8.'
roles:
  - BACK
depends_on:
  - '6.2.2'
  - '4.5.1'
estimated_hours: '1'
tags:
  - api
  - ledger
---

# Task 6.2.3: API endpoints (ledger GET, expense POST)

## Цель

REST endpoints: `GET /ledger` (баланс + история), `POST /ledger/expense` (добавить расход). Только owner/organizer.

## Контекст

Тонкие обёртки над ledgerService. Касса — только для управляющих (canManageContent: owner/organizer).

## Что должно быть сделано

1. **`server/api/organizations/[orgId]/ledger/index.get.ts`:**

   ```ts
   import { ledgerService } from '~/modules/ledger'
   import { requireCanManageContent } from '~/modules/permissions'
   import { createServiceContextFromEvent } from '~/modules/shared/context'

   export default defineEventHandler(async (event) => {
     requireCanManageContent(event.context.member)
     const ctx = createServiceContextFromEvent(event)
     const orgId = event.context.organization!.id
     const query = getQuery(event)
     const [balance, history] = await Promise.all([
       ledgerService.getBalance(ctx, orgId),
       ledgerService.listHistory(ctx, orgId, query),
     ])
     return { balance, ...history }
   })
   ```

2. **`server/api/organizations/[orgId]/ledger/expense.post.ts`:**

   ```ts
   import { ledgerService } from '~/modules/ledger'
   import { requireCanManageContent } from '~/modules/permissions'
   import { createServiceContextFromEvent } from '~/modules/shared/context'
   import { handleServiceError } from '~/server/utils/handle-errors'

   export default defineEventHandler(async (event) => {
     try {
       requireCanManageContent(event.context.member)
       const ctx = createServiceContextFromEvent(event)
       const body = await readBody(event)
       const entry = await ledgerService.addExpense(ctx, event.context.organization!.id, body)
       return { entry }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

3. **handle-errors** — добавить PaymentError, LedgerError codes если есть:
   ```ts
   // ledger использует ZodError для валидации, отдельных LedgerError кодов минимум
   // PaymentError codes (для 6.5):
   'payment.not_found': 404,
   'payment.not_pending': 409,
   'payment.not_succeeded': 409,
   'payment.invalid_target': 422,
   ```

## Критерии приёмки

- ✅ GET /ledger → { balance: {income, expense, balance}, entries, total, pagination }
- ✅ Только owner/organizer (403 для player)
- ✅ Query фильтры передаются в listHistory
- ✅ POST /ledger/expense → создаёт расход, только owner/organizer
- ✅ Невалидная категория (payment_income/refund) → 422
- ✅ PaymentError codes в handle-errors (для 6.5)

## Подсказки

- **Баланс + история одним GET:** UI кассы (6.6) показывает и баланс, и ленту. Возвращаем вместе.
- **requireCanManageContent** (5.1.2) — owner/organizer. Касса не для игроков.
- **PaymentError codes сразу** — пригодятся в 6.5 (payment endpoints).

## Не делать

- ❌ Не делать player-доступ к кассе
- ❌ Не делать экспорт endpoint — Phase 14
- ❌ Не делать редактирование записей
