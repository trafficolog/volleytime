---
id: '5.8.3'
phase: '5'
epic: '5.8'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - QA
  - BACK
depends_on:
  - '5.3.5'
  - '5.5.3'
estimated_hours: '2'
tags:
  - tests
  - concurrency
  - race-conditions
  - core
---

# Task 5.8.3: Concurrency/race tests (capacity, consume)

## Цель

Агрегирующие concurrency-тесты: capacity race (5.3.5), consume race (5.5.3), и комбинированные сценарии (одновременная запись с абонементами на последний слот).

## Контекст

5.3.5 и 5.5.3 покрыли concurrency на уровне отдельных операций. Здесь — комбинированные и стресс-сценарии, и подтверждение что advisory lock + atomic consume работают вместе.

## Что должно быть сделано

1. **`apps/web/modules/__tests__/concurrency.integration.test.ts`:**

   ```ts
   describe('Phase 5 concurrency (integration)', () => {
     test('capacity=1: 5 concurrent books → exactly 1 confirmed, 4 waitlisted', async () => {
       const results = await Promise.allSettled(
         players.map((p) =>
           bookingService.book({ userId: p.id, db: testDb.db }, orgId, eventId, { method: 'free' }),
         ),
       )
       expect(countByStatus('confirmed')).toBe(1)
       expect(countByStatus('waitlisted')).toBe(4)
     })

     test('capacity=10: 20 concurrent → exactly 10 confirmed', async () => {})

     test('subscription total=3: 5 concurrent consumes → exactly 3 succeed', async () => {})

     test('COMBINED: last slot + subscription, 3 players concurrent book with sub', async () => {
       // capacity=1, 3 players each with own subscription total=5
       // all book with method=subscription concurrently
       // exactly 1 confirmed (sub consumed), 2 waitlisted (subs NOT consumed)
       // verify: confirmed player's sub.used=1, others sub.used=0
     })

     test('concurrent cancel + book on same event', async () => {
       // capacity=1, p1 confirmed, p2 waitlisted
       // simultaneously: p1 cancels, p3 tries to book
       // result deterministic: either p3 waitlisted then p2 promoted, or p3 takes slot
       // INVARIANT: confirmed == 1 always
     })

     test('stress: 50 concurrent books, capacity=25', async () => {
       expect(countByStatus('confirmed')).toBe(25)
       expect(countByStatus('waitlisted')).toBe(25)
     })
   })
   ```

2. **Документировать механизмы защиты:**

   ```ts
   // CONCURRENCY DEFENSES (Phase 5):
   // 1. Capacity over-booking: pg_advisory_xact_lock(eventId) in book() (5.3.5)
   //    serializes allocation per-event → confirmed never exceeds capacity
   // 2. Subscription over-consume: atomic UPDATE WHERE used < total (5.5.3)
   //    → used never exceeds total even under concurrency
   // 3. Double-booking: unique(event_id, user_id) (5.3.1) → DB rejects duplicate
   //
   // NOTE: Node single-threaded; Promise.allSettled interleaves async DB ops,
   // exercising race windows. True OS parallelism тестируется в Phase 10 (load test).
   ```

3. **Стабильность:** каждый concurrency-тест прогнать мысленно/в CI несколько раз — не должно быть flaky. Если flaky → баг в atomic-логике, не в тесте.

## Критерии приёмки

- ✅ capacity=1, 5 concurrent → ровно 1 confirmed
- ✅ capacity=10, 20 concurrent → ровно 10 confirmed
- ✅ sub total=3, 5 concurrent consume → ровно 3 успеха
- ✅ COMBINED: последний слот + субсидии — 1 confirmed с consume, остальные waitlist без consume
- ✅ concurrent cancel+book: инвариант confirmed==capacity держится
- ✅ Stress 50/25 → ровно 25 confirmed
- ✅ Все тесты НЕ flaky (детерминированный результат)
- ✅ Механизмы защиты документированы

## Подсказки

- **COMBINED тест — самый ценный.** Проверяет что advisory lock (capacity) и atomic consume (subscription) работают вместе без deadlock. Waitlisted не должны списать сессию.
- **Flaky = баг.** Если тест иногда даёт 2 confirmed при capacity=1 — advisory lock не работает. Исправлять реализацию, не тест.
- **concurrent cancel+book** — недетерминированный порядок, но инвариант (confirmed ≤ capacity) должен держаться при любом порядке.
- **Стресс-тест** не про производительность (это Phase 10), а про корректность под нагрузкой.

## Не делать

- ❌ Не делать load/performance testing (k6) — Phase 10
- ❌ Не мокать БД — нужна реальная PG с locking
- ❌ Не игнорировать flaky — это реальные баги
- ❌ Не полагаться только на app-level проверки
