---
id: '5.3.5'
phase: '5'
epic: '5.3'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - BACK
  - DB
depends_on:
  - '5.3.2'
estimated_hours: '2'
tags:
  - concurrency
  - bookings
  - core
  - security
---

# Task 5.3.5: Concurrency-safe slot allocation + тесты

## Цель

Гарантировать, что при одновременной записи нескольких игроков на последний слот capacity НЕ превышается. Финализировать atomic allocation в BookingService.book.

## Контекст

В 5.3.2 реализована основная логика, но count-then-insert имеет race window: два запроса читают confirmedCount=11 (capacity=12), оба решают «есть место», оба вставляют confirmed → 13 confirmed при capacity 12. Баг.

Решение — атомарность на уровне БД. Несколько подходов; выбираем надёжный для PostgreSQL.

## Что должно быть сделано

1. **Подход: advisory lock на event при allocation.**

   Сериализуем booking-операции для одного события через PostgreSQL advisory lock:

   ```ts
   // внутри транзакции book(), перед определением слота:
   await tx.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)
   // теперь только одна транзакция за раз проходит allocation для этого event
   // advisory_xact_lock автоматически освобождается в конце транзакции
   ```

   После получения lock — COUNT confirmed и INSERT гарантированно атомарны относительно других booking-транзакций того же события.

2. **Альтернатива (документировать, но не реализовывать): conditional insert.**

   Можно через `INSERT ... SELECT ... WHERE (SELECT count(*) ...) < capacity`, но это сложнее читается и не покрывает waitlist логику. Advisory lock проще и явнее для нашего случая.

3. **Обновить `book()` в 5.3.2:**

   ```ts
   return await db.transaction(async (tx) => {
     // ... load event, validate membership, check existing ...

     // CONCURRENCY GUARD: сериализуем allocation для этого события
     await tx.execute(sql`SELECT pg_advisory_xact_lock(${BigInt(eventId)})`)

     // Теперь COUNT confirmed безопасен — никто другой не вставит confirmed параллельно
     const [{ confirmedCount }] = await tx
       .select({ confirmedCount: sql<number>`count(*)::int` })
       .from(bookings)
       .where(and(eq(bookings.eventId, eventId), eq(bookings.status, 'confirmed')))
     const hasSpot = confirmedCount < event.capacity

     // ... resolve method/status, insert/reactivate ...
   })
   ```

4. **Тесты concurrency** (`apps/web/modules/bookings/__tests__/concurrency.integration.test.ts`):

   ```ts
   import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
   import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
   // ... setup org, event с capacity=1

   test('last spot: concurrent book, only one confirmed', async () => {
     // event capacity=1, 2 игрока одновременно book (method=free для простоты)
     const results = await Promise.allSettled([
       bookingService.book({ userId: p1.id, db: testDb.db }, orgId, eventId, { method: 'free' }),
       bookingService.book({ userId: p2.id, db: testDb.db }, orgId, eventId, { method: 'free' }),
     ])
     const confirmed = /* fetch bookings, count confirmed */ expect(confirmed).toBe(1)
     const waitlisted = /* count waitlisted */ expect(waitlisted).toBe(1)
   })

   test('capacity=5, 10 concurrent: exactly 5 confirmed', async () => {
     // ... 10 players, capacity 5
     expect(confirmedCount).toBe(5)
     expect(waitlistedCount).toBe(5)
   })
   ```

   **Замечание о тесте:** Node single-threaded + общий тестовый pool. Promise.allSettled interleave-ит async DB-операции, что воспроизводит race window. Advisory lock сериализует — тест должен показывать ровно capacity confirmed.

5. **Документировать механизм** в комментарии к book():
   ```ts
   // CONCURRENCY: pg_advisory_xact_lock сериализует allocation per-event.
   // Без него count-then-insert race приводит к over-booking (confirmed > capacity).
   // Lock привязан к транзакции, освобождается автоматически на commit/rollback.
   // Альтернатива (не выбрана): SERIALIZABLE isolation + retry — сложнее в обработке.
   ```

## Критерии приёмки

- ✅ Advisory lock добавлен в book() перед allocation
- ✅ capacity=1, 2 concurrent → ровно 1 confirmed, 1 waitlisted
- ✅ capacity=5, 10 concurrent → ровно 5 confirmed, 5 waitlisted
- ✅ confirmed_count НИКОГДА не превышает capacity
- ✅ Тесты стабильны (повторный прогон — тот же результат, не flaky)
- ✅ Lock освобождается (транзакция завершается, нет deadlock)
- ✅ Unique (event_id, user_id) остаётся second line of defense

## Подсказки

- **pg_advisory_xact_lock(key)** — берёт transaction-scoped lock. Освобождается автоматически в конце транзакции (commit/rollback). Не нужно вручную unlock. Идеально для нашего случая.
- **Key — bigint.** eventId как int → BigInt(eventId). Можно комбинировать с orgId через два-аргументную форму `pg_advisory_xact_lock(orgId, eventId)` для большей гранулярности, но eventId достаточно уникален.
- **Почему не SERIALIZABLE:** требует retry-логику при serialization failures, сложнее. Advisory lock проще для точечной сериализации.
- **Производительность:** lock per-event означает booking на разные события параллельны. Только запись на ОДНО событие сериализуется — это приемлемо (booking редкая операция).
- **Deadlock риск:** advisory lock на один key, берётся один раз в начале — deadlock невозможен (нет lock ordering проблемы).

## Не делать

- ❌ Не использовать app-level mutex (не работает на нескольких инстансах)
- ❌ Не использовать SELECT FOR UPDATE на event row (работает, но advisory чище для count-based capacity)
- ❌ Не полагаться ТОЛЬКО на unique constraint (он защищает от двойной записи одного user, не от over-booking разных users)
- ❌ Не делать optimistic locking с version — для capacity advisory проще
