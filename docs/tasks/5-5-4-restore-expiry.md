---
id: '5.5.4'
phase: '5'
epic: '5.5'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
depends_on:
  - '5.5.3'
estimated_hours: '2'
tags:
  - subscriptions
  - tests
---

# Task 5.5.4: restoreSession + expiry handling + тесты

## Цель

Метод `restoreSession` (при отмене брони — used -= 1, exhausted→active обратно). Expiry handling. Comprehensive тесты subscription логики.

## Контекст

restoreSession вызывается из bookingService.cancel (5.6.1) когда отменяется бронь с абонемента. Зеркало consume.

Expiry: subscription с прошедшим expiresAt не используется (consume пропускает), помечается expired (lazily или через будущий job в Phase 15).

## Что должно быть сделано

1. **`service.ts` — restoreSession:**

   ```ts
   /**
    * Восстановить 1 сессию (при отмене брони).
    * exhausted → active (если был исчерпан и не истёк).
    * Вызывается внутри транзакции cancel (ctx.db = tx).
    */
   async restoreSession(ctx: ServiceContext, subscriptionId: number) {
     const db = getDb(ctx)
     const restored = await subscriptionRepository.atomicRestore(db, subscriptionId)
     if (!restored) {
       // used уже 0 — нечего восстанавливать (не должно происходить в норме)
       console.warn(`[subscriptions] restore called but usedSessions already 0: ${subscriptionId}`)
       return null
     }

     // Если был exhausted и теперь used < total — вернуть в active (если не истёк)
     if (restored.status === 'exhausted') {
       const notExpired = !restored.expiresAt || restored.expiresAt > new Date()
       if (notExpired && restored.usedSessions < restored.totalSessions) {
         const [reactivated] = await db.update(subscriptions)
           .set({ status: 'active', updatedAt: new Date() })
           .where(eq(subscriptions.id, subscriptionId)).returning()
         return reactivated!
       }
     }
     return restored
   },

   /**
    * Lazy expiry: пометить expired если expiresAt прошёл.
    * Вызывается опционально при чтении. Полноценный job — Phase 15.
    */
   async markExpiredIfNeeded(ctx: ServiceContext, subscriptionId: number) {
     const db = getDb(ctx)
     const sub = await this.getById(ctx, subscriptionId)
     if (sub.status === 'active' && sub.expiresAt && sub.expiresAt <= new Date()) {
       const [expired] = await db.update(subscriptions)
         .set({ status: 'expired', updatedAt: new Date() })
         .where(eq(subscriptions.id, subscriptionId)).returning()
       return expired!
     }
     return sub
   },
   ```

2. **Comprehensive тесты** (`__tests__/subscription-lifecycle.integration.test.ts`):

   ```ts
   describe('subscription lifecycle', () => {
     test('create pending → activate → active with expiresAt', async () => {})
     test('autoActivate creates active immediately', async () => {})
     test('consume decrements, exhausts at total', async () => {})
     test('restore increments, exhausted → active', async () => {})
     test('restore at used=0 is no-op (warns)', async () => {})
     test('expired sub not consumable', async () => {})
     test('FIFO order across multiple subs', async () => {})
     test('consume then restore returns to original used count', async () => {})
     test('bessрочный (validityDays=null) → expiresAt=null, never expires', async () => {})
   })
   ```

3. **listForUser с remaining** (для UI):
   ```ts
   async listForUserWithRemaining(ctx, orgId) {
     const subs = await this.listActiveForUser(ctx, orgId)
     return subs.map((s) => ({
       ...s,
       remainingSessions: s.totalSessions - s.usedSessions,
     }))
   }
   ```

## Критерии приёмки

- ✅ restoreSession: used-1, exhausted→active (если не истёк)
- ✅ restore при used=0 → no-op + warn (не уходит в минус)
- ✅ consume→restore возвращает к исходному used
- ✅ markExpiredIfNeeded: active+прошёл expiresAt → expired
- ✅ Бессрочный (expiresAt=null) никогда не expired
- ✅ remainingSessions = total - used корректно
- ✅ Все 9 lifecycle тестов проходят

## Подсказки

- **restore exhausted→active:** игрок исчерпал абонемент (exhausted), отменил бронь — сессия вернулась, абонемент снова active. Важно для UX.
- **Lazy expiry vs job:** в Phase 5 помечаем expired при чтении (markExpiredIfNeeded). Полноценный scheduled job «пометить все expired» — Phase 15. Главное — consume не использует истёкшие (findConsumable фильтрует по expiresAt).
- **atomicRestore WHERE used > 0:** защита от ухода в минус при двойном restore (не должно быть, но safety).

## Не делать

- ❌ Не делать scheduled expiry job — Phase 15
- ❌ Не делать refund деньгами — Phase 6
- ❌ Не делать extend/renew абонемента — Phase 14+
