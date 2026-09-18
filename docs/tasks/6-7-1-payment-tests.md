---
id: '6.7.1'
phase: '6'
epic: '6.7'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - QA
  - BACK
depends_on:
  - '6.1.3'
  - '6.1.4'
estimated_hours: '2'
tags:
  - tests
  - payments
---

# Task 6.7.1: Payment service tests (confirm/cancel/refund/edge)

## Цель

Unit/integration тесты PaymentService: confirm (booking/subscription), cancel, refund, edge cases. Деньги — тщательность обязательна.

## Контекст

Payment.confirm — single source of truth (из прототипа). Любой баг = финансовые ошибки. Покрываем все переходы и edge cases.

## Что должно быть сделано

1. **`apps/web/modules/payments/__tests__/payment-service.integration.test.ts`:**

   ```ts
   describe('PaymentService', () => {
     // helpers: setupOrgEvent, createPendingBookingPayment, createPendingSubPayment

     describe('confirm', () => {
       test('booking payment → succeeded + booking confirmed + ledger income', async () => {})
       test('subscription payment → succeeded + subscription active + ledger income', async () => {})
       test('booking already cancelled → payment succeeded, booking untouched, ledger income', async () => {})
       test('booking already confirmed (via other) → payment succeeded, no double-confirm', async () => {})
       test('non-pending payment → PaymentNotPendingError', async () => {})
       test('confirmedByUserId and confirmedAt set', async () => {})
       test('ledger income amount == payment amount', async () => {})
       test('subscription activate sets expiresAt from plan validityDays', async () => {})
     })

     describe('cancel', () => {
       test('pending booking payment → cancelled + booking cancelled', async () => {})
       test('pending subscription payment → cancelled + subscription cancelled', async () => {})
       test('cancel triggers waitlist promotion (booking)', async () => {})
       test('non-pending → PaymentNotPendingError', async () => {})
     })

     describe('refund', () => {
       test('succeeded → refunded + ledger expense (refund category)', async () => {})
       test('refund amount == payment amount', async () => {})
       test('non-succeeded → PaymentNotSucceededError', async () => {})
       test('refundedAt set', async () => {})
     })

     describe('append-only invariants', () => {
       test('succeeded payment status preserved (refund adds new ledger, not edits payment amount)', async () => {})
       test('confirm then refund: payment succeeded → refunded, two ledger entries (income + expense)', async () => {})
     })
   })
   ```

2. **Edge case — confirm с booking в разных статусах:**

   ```ts
   // booking cancelled до confirm → payment succeeded (деньги получены), booking не трогаем
   // booking waitlisted → payment succeeded, booking не трогаем (странно, но деньги есть)
   // booking confirmed (subscription активировал?) → payment succeeded, не дублируем
   ```

3. **Инвариант проверки:**
   ```ts
   // после confirm: ledger income создан, amount совпадает
   // после refund: ledger expense создан, payment refunded (не удалён)
   // confirm+refund: net ledger = 0 (income - expense)
   ```

## Критерии приёмки

- ✅ confirm: booking/subscription side effects + ledger income
- ✅ confirm edge: booking не pending → payment succeeded, booking untouched
- ✅ confirm non-pending → ошибка
- ✅ cancel: booking/subscription cancelled, promotion
- ✅ refund: refunded + ledger expense
- ✅ refund non-succeeded → ошибка
- ✅ Append-only: succeeded не редактируется, refund отдельной записью
- ✅ confirm+refund net ledger = 0
- ✅ ≥ 18 тестов, стабильны

## Подсказки

- **Edge case confirm (решение 4)** — самый важный нетривиальный тест. Деньги получены физически → payment succeeded всегда, booking трогаем только если ждёт.
- **Helpers** для setup (org/event/booking/payment) — сократят дублирование.
- **Append-only** — проверяй что payment.amount не меняется при refund, создаётся новая ledger запись.

## Не делать

- ❌ Не делать HTTP — Phase 9
- ❌ Не дублировать ledger unit (6.7.2)
