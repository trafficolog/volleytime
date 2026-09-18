---
id: '7.8.1'
phase: '7'
epic: '7.8'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - QA
  - BACK
depends_on:
  - '7.3.1'
  - '7.3.2'
  - '7.2.1'
estimated_hours: '1-2'
tags:
  - tests
  - credits
---

# Task 7.8.1: Account/spend/refund/demo tests

## Цель

Тесты: demo grant, spend/блок при 0, refund до/после открытия записи, append-only инварианты, balance == SUM.

## Контекст

Монетизация — баги = потеря дохода. Тщательные тесты spend/refund/demo + инварианты.

## Что должно быть сделано

1. **`apps/web/modules/credits/__tests__/credit-core.integration.test.ts`:**

   ```ts
   describe('credit account & transactions', () => {
     test('new org gets 5 demo credits', async () => {})
     test('demo grant atomic with org creation', async () => {})

     test('create event spends 1 credit', async () => {})
     test('balance decreases after event creation', async () => {})
     test('create event at 0 balance → InsufficientCreditsError, event not created', async () => {})

     test('cancel event without bookings → credit refunded', async () => {})
     test('cancel event with bookings → no credit refund', async () => {})
     test('double cancel → single refund', async () => {})

     test('balance == SUM(transaction amounts)', async () => {})
     test('balanceAfter matches running balance', async () => {})
     test('transactions append-only (not edited)', async () => {})
   })
   ```

2. **Инвариант balance:**

   ```ts
   test('invariant: account.balance always equals SUM(transactions.amount)', async () => {
     // после серии операций (demo + spend + refund + purchase) проверить
   })
   ```

3. **Atomic rollback:**
   ```ts
   test('event creation rolls back if credit spend fails', async () => {})
   ```

## Критерии приёмки

- ✅ Demo grant (5 credits, atomic)
- ✅ Spend (−1, блок при 0, event not created)
- ✅ Refund (без броней → да, с бронями → нет, идемпотентно)
- ✅ Balance == SUM(amounts) инвариант
- ✅ balanceAfter консистентен
- ✅ Append-only
- ✅ Atomic rollback (spend fail → event rollback)
- ✅ ≥ 10 тестов

## Подсказки

- **Balance инвариант — главный** — денормализованный balance ДОЛЖЕН всегда == SUM(transactions). Проверять после серий операций.
- **Atomic rollback** — spend fail (0 баланс) откатывает создание Event. Критичный тест.
- **Refund условие** — до/после открытия записи (наличие броней). Граничный случай.

## Не делать

- ❌ Не дублировать pricing тесты (7.8.2)
- ❌ Не делать E2E HTTP
