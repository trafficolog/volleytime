---
id: '5.8.2'
phase: '5'
epic: '5.8'
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
  - cancellation
  - waitlist
---

# Task 5.8.2: Cancellation + waitlist promotion tests

## Цель

Агрегирующие integration-тесты полного жизненного цикла с акцентом на межмодульное взаимодействие booking ↔ subscription ↔ waitlist. Дополняет 5.6.3.

## Контекст

5.6.3 покрыл cancellation/promotion на уровне эпика 5.6. Эта задача — финальная проверка end-to-end сценариев, объединяющих всё ядро Phase 5. Координируется с 5.6.3 (не дублировать, а расширять полными цепочками).

## Что должно быть сделано

1. **`apps/web/modules/__tests__/full-lifecycle.integration.test.ts`:**

   ```ts
   describe('Phase 5 full lifecycle (integration)', () => {
     test('end-to-end: create event → buy sub → book → cancel → restore + promote', async () => {
       // 1. Owner создаёт event capacity=2, price>0
       // 2. p1,p2,p3 покупают абонементы (autoActivate)
       // 3. p1 book (sub consume) → confirmed
       // 4. p2 book (sub consume) → confirmed
       // 5. p3 book (sub) → waitlisted, sub NOT consumed
       // 6. p1 cancel → p1 sub restored, p3 promoted + p3 sub consumed
       // 7. verify: p1 cancelled+sub restored, p2 confirmed, p3 confirmed+sub consumed
       // INVARIANT: confirmed count == 2 == capacity
     })

     test('attendance flow: book → confirmed → mark attended', async () => {})

     test('mixed methods: subscription + cash + free in same event', async () => {
       // event capacity=3: p1 sub, p2 cash (pending_payment), p3 free
       // all confirmed/pending correctly
     })

     test('deadline: player blocked after deadline, admin bypass works', async () => {})

     test('cascade promotion preserves FIFO order', async () => {
       // capacity=1, waitlist [p2,p3,p4] by bookedAt
       // cancel confirmed p1 → p2 promoted
       // cancel p2 → p3 promoted (not p4)
     })
   })
   ```

2. **Инвариант-чекер helper:**
   ```ts
   async function assertEventInvariants(db, eventId, capacity) {
     const confirmed = await countBookings(db, eventId, 'confirmed')
     expect(confirmed).toBeLessThanOrEqual(capacity)
   }

   async function assertSubscriptionInvariants(db, subId) {
     const sub = await getSubscription(db, subId)
     expect(sub.usedSessions).toBeGreaterThanOrEqual(0)
     expect(sub.usedSessions).toBeLessThanOrEqual(sub.totalSessions)
   }
   ```

## Критерии приёмки

- ✅ End-to-end сценарий: event→sub→book→cancel→restore+promote корректен
- ✅ Attendance flow работает
- ✅ Mixed methods в одном событии
- ✅ Deadline enforcement + admin bypass
- ✅ Cascade promotion сохраняет FIFO
- ✅ Инварианты проверяются после операций (confirmed ≤ capacity, 0 ≤ used ≤ total)
- ✅ Тесты стабильны

## Подсказки

- **Это интеграционный венец Phase 5** — самые реалистичные сценарии. Если эти зелёные — ядро работает.
- **Инвариант-чекеры** вызывай после каждой мутации в сложных тестах. Ловят тонкие баги.
- **Координация с 5.6.3:** 5.6.3 — юнит-уровень эпика 5.6 (cancel, promote изолированно). Здесь — полные цепочки через несколько модулей. Если сценарий уже в 5.6.3 — не дублируй.

## Не делать

- ❌ Не дублировать 5.6.3 базовые cancel/promote
- ❌ Не делать HTTP E2E — Phase 9
- ❌ Не делать UI тесты — 5.12
