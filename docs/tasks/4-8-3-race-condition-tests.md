---
id: '4.8.3'
phase: '4'
epic: '4.8'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - QA
  - BACK
depends_on:
  - '4.4.2'
estimated_hours: '1-2'
tags:
  - tests
  - concurrency
  - race-conditions
---

# Task 4.8.3: Race condition tests

## Цель

Тесты на конкурентность: несколько user одновременно принимают invite с лимитом, защита от двойного membership.

## Контекст

Race conditions — тонкие баги, проявляются только под нагрузкой. Phase 4 имеет 2 критических места:

1. `invite.acceptInvite` с `maxUses` — два user'а одновременно, только N должны пройти
2. Двойное добавление member (unique constraint защита)

## Что должно быть сделано

1. **`apps/web/modules/__tests__/race-conditions.integration.test.ts`:**

   ```ts
   import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
   import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
   import { organizationService } from '~/modules/organizations'
   import { inviteService, InviteUsesExhaustedError } from '~/modules/invites'

   describe('race conditions (integration)', () => {
     let testDb: TestDb

     beforeAll(async () => {
       testDb = await createTestDb()
     })
     afterAll(async () => {
       await testDb.close()
     })
     beforeEach(async () => {
       await testDb.truncate()
     })

     test('concurrent accept with maxUses=1: only one succeeds', async () => {
       const owner = await createTestUser(testDb.db, { email: 'o@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test' },
       )
       const invite = await inviteService.createInvite(
         { userId: owner.id, db: testDb.db },
         { organizationId: org.id, maxUses: 1 },
       )

       const player1 = await createTestUser(testDb.db, { email: 'p1@t.com' })
       const player2 = await createTestUser(testDb.db, { email: 'p2@t.com' })

       // Concurrent accept
       const results = await Promise.allSettled([
         inviteService.acceptInvite({ userId: player1.id, db: testDb.db }, invite.token),
         inviteService.acceptInvite({ userId: player2.id, db: testDb.db }, invite.token),
       ])

       const fulfilled = results.filter((r) => r.status === 'fulfilled')
       const rejected = results.filter((r) => r.status === 'rejected')

       expect(fulfilled.length).toBe(1)
       expect(rejected.length).toBe(1)

       // Verify usesCount is exactly 1
       const finalInvite = await testDb.db.query.inviteLinks.findFirst({
         where: (i, { eq }) => eq(i.id, invite.id),
       })
       expect(finalInvite?.usesCount).toBe(1)
     })

     test('concurrent accept maxUses=5 with 10 users: exactly 5 succeed', async () => {
       const owner = await createTestUser(testDb.db, { email: 'o@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test' },
       )
       const invite = await inviteService.createInvite(
         { userId: owner.id, db: testDb.db },
         { organizationId: org.id, maxUses: 5 },
       )

       const players = await Promise.all(
         Array.from({ length: 10 }, (_, i) =>
           createTestUser(testDb.db, { email: `player${i}@t.com` }),
         ),
       )

       const results = await Promise.allSettled(
         players.map((p) =>
           inviteService.acceptInvite({ userId: p.id, db: testDb.db }, invite.token),
         ),
       )

       const fulfilled = results.filter((r) => r.status === 'fulfilled')
       expect(fulfilled.length).toBe(5)

       const finalInvite = await testDb.db.query.inviteLinks.findFirst({
         where: (i, { eq }) => eq(i.id, invite.id),
       })
       expect(finalInvite?.usesCount).toBe(5)
     })

     test('same user concurrent accept: only one membership created', async () => {
       const owner = await createTestUser(testDb.db, { email: 'o@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test' },
       )
       const invite = await inviteService.createInvite(
         { userId: owner.id, db: testDb.db },
         { organizationId: org.id, maxUses: 10 },
       )
       const player = await createTestUser(testDb.db, { email: 'p@t.com' })

       // Same user tries to accept twice concurrently
       const results = await Promise.allSettled([
         inviteService.acceptInvite({ userId: player.id, db: testDb.db }, invite.token),
         inviteService.acceptInvite({ userId: player.id, db: testDb.db }, invite.token),
       ])

       // At most one succeeds; no duplicate membership
       const memberships = await testDb.db.query.organizationMembers.findMany({
         where: (m, { and, eq }) => and(eq(m.organizationId, org.id), eq(m.userId, player.id)),
       })
       expect(memberships.length).toBe(1) // unique constraint защищает
     })
   })
   ```

2. **Замечание о реализме теста concurrency в Node:**

   Добавить комментарий в тест:

   ```ts
   // NOTE: Node.js single-threaded event loop means Promise.allSettled doesn't give
   // true OS-level parallelism, but it DOES interleave async DB operations, which is
   // enough to exercise the race window in our increment logic.
   // The real protection is the atomic SQL `WHERE uses_count < max_uses` (4.4.2)
   // and the unique constraint on (organization_id, user_id) (4.2.1).
   // For true load testing, see Phase 10 (pre-launch).
   ```

3. **Документировать ожидаемое поведение:**
   - maxUses enforcement — через атомарный `UPDATE ... WHERE usesCount < maxUses RETURNING` (4.4.2)
   - duplicate membership — через `unique (organization_id, user_id)` constraint (4.2.1)

## Критерии приёмки

- ✅ Concurrent accept с maxUses=1: ровно 1 успех, 1 отказ
- ✅ Concurrent accept maxUses=5 / 10 users: ровно 5 успехов
- ✅ usesCount после concurrent точно равен maxUses (не превышает!)
- ✅ Тот же user concurrent: ровно 1 membership (unique constraint)
- ✅ Тесты документированы с объяснением механизма защиты
- ✅ Тесты проходят стабильно (не flaky)

## Подсказки

- **`Promise.allSettled`** — запускает все промисы, ждёт все, не падает на первом reject. Идеально для race-тестов.
- **Атомарность в PostgreSQL:** `UPDATE ... WHERE condition RETURNING` — атомарна на уровне строки. Два concurrent UPDATE одной строки сериализуются БД.
- **Почему usesCount не превышает maxUses:** второй UPDATE видит usesCount уже инкрементированным первым (благодаря row-level locking), его `WHERE usesCount < maxUses` становится false → 0 rows updated → null → InviteUsesExhaustedError.
- **Flaky tests:** если тест иногда падает — проблема в реализации (не атомарно), не в тесте. Это сигнал баг исправить.

## Не делать

- ❌ Не делать настоящий load testing (k6, artillery) — Phase 10
- ❌ Не мокать БД для race-тестов — нужна реальная PG с её locking
- ❌ Не игнорировать flaky — это реальные баги конкурентности
- ❌ Не полагаться только на app-level проверки (check-then-act) — всегда БД constraints как последний рубеж
