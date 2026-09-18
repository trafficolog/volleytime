---
id: '6.7.2'
phase: '6'
epic: '6.7'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 6.8.'
roles:
  - QA
  - BACK
depends_on:
  - '6.2.2'
  - '6.3.1'
  - '6.3.2'
estimated_hours: '1-2'
tags:
  - tests
  - ledger
  - integration
---

# Task 6.7.2: Ledger + integration tests (booking/subscription confirm)

## Цель

Тесты LedgerService (balance, history, addExpense) + integration flow: cash booking → payment → confirm → booking confirmed + ledger income; платный subscription → payment → confirm → active.

## Контекст

Ledger — финансовая картина организации. Integration-тесты проверяют связку payment+ledger: путь денег от записи/покупки до фиксации в кассе. Дополняет payment unit-тесты (6.7.1) сквозными сценариями.

## Что должно быть сделано

1. **`apps/web/modules/ledger/__tests__/ledger-service.integration.test.ts`:**

   ```ts
   describe('LedgerService', () => {
     test('getBalance empty → 0/0/0', async () => {})
     test('income entries sum correctly', async () => {})
     test('expense entries sum correctly', async () => {})
     test('balance = income - expense', async () => {})
     test('addExpense creates expense entry', async () => {})
     test('addExpense rejects income categories (zod)', async () => {})
     test('listHistory filters by type', async () => {})
     test('listHistory filters by category', async () => {})
     test('listHistory filters by date range', async () => {})
     test('listHistory pagination', async () => {})
     test('history sorted desc by createdAt', async () => {})
   })
   ```

2. **`apps/web/modules/__tests__/payment-integration.integration.test.ts`:**

   ```ts
   describe('Payment integration flow', () => {
     test('cash booking creates pending payment', async () => {
       // book cash → booking pending_payment + payment pending linked
     })
     test('cash booking → confirm → booking confirmed + ledger income', async () => {
       // full flow
     })
     test('free booking creates no payment', async () => {})
     test('subscription booking creates no payment', async () => {})

     test('free plan → subscription active, no payment', async () => {})
     test('paid plan → subscription pending + payment pending', async () => {})
     test('paid plan → confirm payment → subscription active', async () => {
       // createFromPlan (paid) → payment → confirm → sub.status active, expiresAt set
     })

     test('promoted cash booking creates payment', async () => {
       // waitlist cash → promote → pending_payment + payment created
     })
   })
   ```

3. **Balance инвариант после серии операций:**
   ```ts
   test('balance reflects series: 2 confirms + 1 expense + 1 refund', async () => {
     // income 1000 + income 1500 = 2500
     // expense rent 500
     // refund 1000 (expense)
     // balance = 2500 - 500 - 1000 = 1000
   })
   ```

## Критерии приёмки

- ✅ Ledger: balance расчёт (income/expense/0), фильтры (type/category/date), pagination, сортировка
- ✅ addExpense rejects payment_income/refund категории
- ✅ Integration: cash booking → payment pending → confirm → booking confirmed + ledger income
- ✅ free/subscription booking → no payment
- ✅ paid plan → payment → confirm → subscription active
- ✅ promoted cash → payment created
- ✅ Balance инвариант после серии операций
- ✅ ≥ 18 тестов

## Подсказки

- **Integration flow** проверяет связку 6.1+6.2+6.3 — реальный путь денег.
- **Balance инвариант** — лучший acceptance: серия операций, итоговый баланс предсказуем.
- **addExpense category restriction** — важно: payment_income/refund нельзя руками.

## Не делать

- ❌ Не дублировать payment unit (6.7.1)
- ❌ Не делать mass refund (6.7.3)
- ❌ Не делать HTTP — Phase 9
