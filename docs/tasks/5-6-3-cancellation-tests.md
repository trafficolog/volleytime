---
id: '5.6.3'
phase: '5'
epic: '5.6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - QA
  - BACK
depends_on:
  - '5.6.1'
  - '5.6.2'
estimated_hours: '1-2'
tags:
  - tests
  - bookings
  - integration
---

# Task 5.6.3: Edge cases + integration тесты cancellation/waitlist

## Цель

Comprehensive integration тесты полного цикла cancel + promotion + restore. Edge cases.

## Контекст

Cancellation + promotion — связывают bookings и subscriptions. Здесь самые сложные межмодульные сценарии Phase 5. Тщательное тестирование критично.

## Что должно быть сделано

1. **`apps/web/modules/bookings/__tests__/cancel-promote.integration.test.ts`:**

   ```ts
   describe('cancel + waitlist promotion (integration)', () => {
     // Helpers: setupEvent(capacity), addPlayers(n), bookAll()

     test('full cycle: capacity=2, 3 players, cancel 1 confirmed → waitlisted promoted', async () => {
       // p1, p2 confirmed; p3 waitlisted
       // cancel p1 → p3 promoted to confirmed
       // verify: p1 cancelled, p2 confirmed, p3 confirmed
     })

     test('subscription restore + promotion consume', async () => {
       // p1 books with subscription (consume), p2 waitlisted with subscription
       // cancel p1 → restore p1 session, consume p2 session, p2 confirmed
       // verify session counts
     })

     test('chain promotion: cancel cascade', async () => {
       // capacity=1: p1 confirmed, p2/p3 waitlisted
       // cancel p1 → p2 confirmed
       // cancel p2 → p3 confirmed
       // cancel p3 → no one left, slot empty
     })

     test('cancel waitlisted: no promotion, others unaffected', async () => {
       // capacity=2: p1,p2 confirmed, p3,p4 waitlisted
       // cancel p3 (waitlisted) → p4 still waitlisted, p1/p2 confirmed
     })

     test('deadline enforcement', async () => {
       // event starts in 1h, deadline 2h → player cannot cancel
       // admin can cancel
     })

     test('promotion with exhausted subscription falls to pending_payment', async () => {
       // p2 waitlisted with sub that gets exhausted before promotion
       // cancel confirmed → p2 promoted to pending_payment
     })

     test('cancel restores exhausted subscription to active', async () => {
       // sub total=1, used=1 (exhausted), booking confirmed
       // cancel → restore → sub active again, used=0
     })
   })
   ```

2. **Регрессия:** убедиться что Phase 4 тесты и booking allocation (5.3.5) не сломаны.

3. **Документировать инварианты:**
   ```ts
   // INVARIANT: confirmed_count <= capacity ALWAYS (even after promotions)
   // INVARIANT: sum of subscription used never exceeds total
   // INVARIANT: cancelled booking never holds a subscription session
   ```

## Критерии приёмки

- ✅ Full cycle: cancel confirmed → waitlist promoted
- ✅ Subscription restore + promotion consume в одной отмене
- ✅ Chain promotion (каскад отмен)
- ✅ Cancel waitlisted без promotion
- ✅ Deadline enforcement (player blocked, admin bypass)
- ✅ Exhausted subscription при промоушене → pending_payment
- ✅ Cancel восстанавливает exhausted → active
- ✅ Инвариант confirmed_count <= capacity держится после всех операций
- ✅ Все тесты стабильны

## Подсказки

- **Helpers сократят дублирование:** setupEvent, addPlayers, bookPlayer. Каждый тест читаемый.
- **Проверка инвариантов после каждой операции** — лучший способ поймать тонкие баги. После любого cancel/promote: COUNT confirmed <= capacity.
- **Session accounting:** после cancel+restore сумма used по всем subs игрока должна соответствовать его активным confirmed booking с method=subscription.

## Не делать

- ❌ Не делать E2E HTTP — Phase 9
- ❌ Не дублировать unit consume-тесты (5.5.4)
- ❌ Не делать load testing — Phase 10
