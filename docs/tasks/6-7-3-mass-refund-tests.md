---
id: '6.7.3'
phase: '6'
epic: '6.7'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - QA
  - BACK
depends_on:
  - '6.4.1'
  - '6.4.2'
estimated_hours: '1-2'
tags:
  - tests
  - refund
  - integration
---

# Task 6.7.3: Mass refund tests

## Цель

Финальные агрегирующие тесты mass refund при отмене события. Все комбинации методов оплаты, инварианты, idempotency.

## Контекст

Дополняет 6.4.2 (базовая интеграция эпика) полными сценариями. mass refund — критичная финансовая операция, заслуживает отдельного тщательного покрытия.

## Что должно быть сделано

1. **`apps/web/modules/__tests__/mass-refund-acceptance.integration.test.ts`:**

   ```ts
   describe('Mass refund acceptance', () => {
     test('full mix: subscription + cash-succeeded + cash-pending + waitlist', async () => {
       // event capacity=3, price=1000
       // p1: subscription (consumed), confirmed
       // p2: cash → payment confirmed (succeeded), booking confirmed
       // p3: cash → payment pending, booking pending_payment
       // p4: cash → waitlisted (capacity full), payment? (нет — waitlist не создаёт)
       //
       // confirm p2's payment first (ledger income 1000)
       //
       // CANCEL EVENT:
       //   p1: session restored (used 1→0), booking cancelled
       //   p2: payment refunded (ledger expense 1000), booking cancelled
       //   p3: payment cancelled, booking cancelled
       //   p4: booking cancelled (waitlist)
       //   event cancelled
       //
       // ASSERTIONS:
       //   - all bookings cancelled
       //   - p1 subscription used == 0
       //   - p2 payment refunded
       //   - p3 payment cancelled
       //   - ledger balance == 0 (income 1000 - expense 1000)
     })

     test('all subscriptions: every session restored', async () => {})

     test('idempotent: cancel twice → same state, no double refund', async () => {})

     test('ledger net zero after refunds', async () => {
       // sum of refund expenses == sum of confirmed payment incomes for the event
     })

     test('no promotion triggered during mass cancel', async () => {
       // waitlist players cancelled, not promoted
     })

     test('cancelled event not bookable afterward', async () => {})
   })
   ```

2. **Инвариант-чекеры:**

   ```ts
   async function assertEventFullyRefunded(db, eventId) {
     const bs = await getBookings(db, eventId)
     // все cancelled
     expect(bs.every((b) => b.status === 'cancelled')).toBe(true)
     // succeeded payments → refunded
     // pending payments → cancelled
   }
   ```

3. **Документировать как acceptance:**
   ```ts
   // MASS REFUND ACCEPTANCE: отмена события возвращает всё в исходное:
   // - сессии абонементов восстановлены (игроки не пострадали)
   // - оплаченные деньги возвращены (ledger expense)
   // - неоплаченные брони отменены
   // Зелёный = финансовый контур Phase 6 корректен при отмене.
   ```

## Критерии приёмки

- ✅ Full mix сценарий: subscription restore + cash refund + pending cancel + waitlist cancel
- ✅ All subscriptions → все сессии восстановлены
- ✅ Idempotent (двойной cancel)
- ✅ Ledger net zero (refund expenses == event confirmed incomes)
- ✅ Promotion НЕ триггерится при mass cancel
- ✅ Cancelled event не бронируется
- ✅ Инвариант-чекеры используются
- ✅ ≥ 6 тестов, стабильны

## Подсказки

- **Net zero ledger** — ключевой финансовый инвариант: что собрали за событие, то вернули при отмене. Баланс по событию = 0.
- **No promotion** — отличие от обычного cancel. Событие целиком отменяется, продвигать некуда.
- **Idempotency** — отмена уже отменённого не делает второй refund (деньги не возвращаются дважды).

## Не делать

- ❌ Не дублировать базовые из 6.4.2
- ❌ Не делать HTTP — Phase 9
- ❌ Не делать нагрузочное — Phase 10
