---
id: '5.5.3'
phase: '5'
epic: '5.5'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
  - DB
depends_on:
  - '5.5.2'
estimated_hours: '2-3'
tags:
  - subscriptions
  - concurrency
  - core
---

# Task 5.5.3: consumeSession atomic + FIFO selection

## Цель

Реализовать `consumeSession` — атомарное списание одной сессии абонемента. FIFO-выбор по expires_at. Concurrency-safe: нельзя списать больше total.

## Контекст

Один из двух критичных по корректности участков Phase 5 (второй — booking allocation 5.3.5). Прямой перенос из Python-прототипа: `UPDATE ... SET used = used + 1 WHERE used < total RETURNING`.

Решение 9 (atomic consume), решение 10 (FIFO по expires_at).

Вызывается из bookingService.book (5.3.2) когда method=subscription.

## Что должно быть сделано

1. **`repository.ts` — atomic increment:**

   ```ts
   import { subscriptions } from '@volley-time/db'
   import { eq, and, sql, lte, gt, isNull, or, asc } from 'drizzle-orm'

   export const subscriptionRepository = {
     /**
      * Атомарно списывает 1 сессию с конкретного subscription.
      * Возвращает обновлённый subscription, или null если списать нельзя
      * (used >= total — гонка проиграна / уже исчерпан).
      */
     async atomicConsume(db: DB, subscriptionId: number): Promise<Subscription | null> {
       const [updated] = await db
         .update(subscriptions)
         .set({ usedSessions: sql`${subscriptions.usedSessions} + 1`, updatedAt: new Date() })
         .where(
           and(
             eq(subscriptions.id, subscriptionId),
             eq(subscriptions.status, 'active'),
             sql`${subscriptions.usedSessions} < ${subscriptions.totalSessions}`,
           ),
         )
         .returning()
       return updated ?? null
     },

     /**
      * Атомарно восстанавливает 1 сессию (при отмене брони).
      */
     async atomicRestore(db: DB, subscriptionId: number): Promise<Subscription | null> {
       const [updated] = await db
         .update(subscriptions)
         .set({ usedSessions: sql`${subscriptions.usedSessions} - 1`, updatedAt: new Date() })
         .where(and(eq(subscriptions.id, subscriptionId), sql`${subscriptions.usedSessions} > 0`))
         .returning()
       return updated ?? null
     },

     /**
      * FIFO: активные subs пользователя с remaining sessions, не истёкшие,
      * сортировка по expiresAt ASC (раньше истекает — первым). NULL expiresAt — в конце.
      */
     async findConsumable(db: DB, orgId: number, userId: number): Promise<Subscription[]> {
       const now = new Date()
       return db.query.subscriptions.findMany({
         where: and(
           eq(subscriptions.userId, userId),
           eq(subscriptions.organizationId, orgId),
           eq(subscriptions.status, 'active'),
           sql`${subscriptions.usedSessions} < ${subscriptions.totalSessions}`,
           or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now)),
         ),
         orderBy: sql`${subscriptions.expiresAt} ASC NULLS LAST`,
       })
     },
   }
   ```

2. **`service.ts` — consumeSession:**

   ```ts
   import { NoActiveSubscriptionError } from './errors'

   /**
    * Списать 1 сессию. FIFO по expiresAt.
    * Если specificId задан — списать с него (проверив принадлежность).
    * Возвращает { subscriptionId, subscription }.
    * Бросает NoActiveSubscriptionError если нет подходящего абонемента.
    *
    * ВАЖНО: вызывается внутри транзакции booking (ctx.db = tx).
    */
   async consumeSession(ctx: ServiceContext, orgId: number, specificId?: number) {
     const db = getDb(ctx)

     if (specificId) {
       // Списать с конкретного (проверив ownership)
       const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, specificId) })
       if (!sub || sub.userId !== ctx.userId || sub.organizationId !== orgId) {
         throw new NoActiveSubscriptionError()
       }
       const consumed = await subscriptionRepository.atomicConsume(db, specificId)
       if (!consumed) throw new NoActiveSubscriptionError()
       await this.markExhaustedIfNeeded(db, consumed)
       return { subscriptionId: consumed.id, subscription: consumed }
     }

     // FIFO: перебираем consumable, пытаемся списать с первого успешного
     const candidates = await subscriptionRepository.findConsumable(db, orgId, ctx.userId)
     if (candidates.length === 0) throw new NoActiveSubscriptionError()

     for (const candidate of candidates) {
       const consumed = await subscriptionRepository.atomicConsume(db, candidate.id)
       if (consumed) {
         await this.markExhaustedIfNeeded(db, consumed)
         return { subscriptionId: consumed.id, subscription: consumed }
       }
       // null = гонка проиграна (кто-то списал последнюю), пробуем следующий
     }
     throw new NoActiveSubscriptionError()
   },

   /** Если used достиг total — пометить exhausted. */
   async markExhaustedIfNeeded(db, sub: Subscription) {
     if (sub.usedSessions >= sub.totalSessions) {
       await db.update(subscriptions).set({ status: 'exhausted', updatedAt: new Date() })
         .where(eq(subscriptions.id, sub.id))
     }
   },
   ```

3. **Тесты concurrency** (`__tests__/consume.integration.test.ts`):
   ```ts
   test('atomic consume: total=3, 5 concurrent consumes → exactly 3 succeed', async () => {
     // создать active sub total=3
     const results = await Promise.allSettled(
       Array.from({ length: 5 }, () =>
         subscriptionService.consumeSession({ userId: user.id, db: testDb.db }, orgId, sub.id),
       ),
     )
     const ok = results.filter((r) => r.status === 'fulfilled').length
     expect(ok).toBe(3)
     const final = await /* fetch sub */ expect(final.usedSessions).toBe(3)
     expect(final.status).toBe('exhausted')
   })

   test('FIFO: consumes from earliest-expiring first', async () => {
     // 2 active subs: subA expires in 10 days, subB in 30 days
     await subscriptionService.consumeSession(ctx, orgId) // no specificId
     // subA.used should be 1, subB.used 0
   })

   test('skips expired subscriptions', async () => {
     // sub с expiresAt в прошлом — не consumable
   })

   test('skips exhausted subscriptions', async () => {
     // sub used==total — не consumable
   })
   ```

## Критерии приёмки

- ✅ atomicConsume: used+1 только если used < total и status=active
- ✅ Возвращает null если списать нельзя (гонка/исчерпан)
- ✅ FIFO: списывает с наименьшим expiresAt первым, NULL expiresAt — последними
- ✅ consumeSession с specificId: проверяет ownership, списывает с него
- ✅ Без specificId: перебирает candidates, списывает с первого успешного
- ✅ used достиг total → status=exhausted
- ✅ Expired subs пропускаются (не consumable)
- ✅ Concurrency: total=3, 5 parallel → ровно 3 успеха, used=3, status=exhausted
- ✅ Нет подходящего → NoActiveSubscriptionError

## Подсказки

- **Атомарность через WHERE used < total:** это и есть защита от over-consume. Два параллельных UPDATE одной строки сериализуются БД (row lock). Второй видит used уже инкрементированным, его WHERE становится false → 0 rows → null.
- **FIFO retry loop:** если первый candidate проиграл гонку (null), пробуем следующий. Это покрывает edge case когда несколько subs и параллельные consume.
- **NULLS LAST:** бессрочные абонементы (expiresAt=null) списываются последними — сначала тратим истекающие. PostgreSQL `ORDER BY ... ASC NULLS LAST`.
- **Вызов внутри booking транзакции:** ctx.db = tx. consume и booking insert — атомарны вместе. Если booking падает после consume — rollback вернёт сессию.

## Не делать

- ❌ Не делать app-level lock — atomic SQL достаточно
- ❌ Не списывать с expired/exhausted
- ❌ Не делать partial consume (всегда 1 сессия)
- ❌ Не делать consume для waitlisted booking — только confirmed (списываем при promotion в 5.6)
