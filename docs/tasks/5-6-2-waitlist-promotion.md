---
id: '5.6.2'
phase: '5'
epic: '5.6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - BACK
depends_on:
  - '5.6.1'
estimated_hours: '1-2'
tags:
  - bookings
  - waitlist
  - core
---

# Task 5.6.2: Waitlist promotion (synchronous)

## Цель

`promoteFromWaitlist` — при освобождении confirmed слота продвинуть первого waitlisted (FIFO по bookedAt) в confirmed. Если promoted был с абонементом — consume при промоушене.

## Контекст

Решение 13: synchronous promotion без TTL-подтверждения (это Phase 15). Отмена confirmed → сразу первый из waitlist в confirmed.

Из прототипа: promote по порядку записи (bookedAt ASC).

Тонкость: waitlisted booking при создании НЕ списывал сессию (5.3.2). При promotion для method=subscription нужно consume. Если consume не удался (сессия кончилась) — пропускаем, берём следующего? Или promote в pending_payment? Решение ниже.

## Что должно быть сделано

1. **`service.ts` — promoteFromWaitlist:**

   ```ts
   import { subscriptionService } from '../subscriptions'
   import { NoActiveSubscriptionError } from '../subscriptions'

   /**
    * Продвинуть первого из waitlist в confirmed (FIFO).
    * Вызывается внутри транзакции cancel.
    * Возвращает promoted booking или null (waitlist пуст).
    */
   async promoteFromWaitlist(ctx: ServiceContext, eventId: number) {
     const db = getDb(ctx)

     // Первый waitlisted по bookedAt (FIFO)
     const next = await db.query.bookings.findFirst({
       where: and(eq(bookings.eventId, eventId), eq(bookings.status, 'waitlisted')),
       orderBy: (b, { asc }) => [asc(b.bookedAt)],
     })
     if (!next) return null  // waitlist пуст

     // Определить новый статус по методу
     let status: 'confirmed' | 'pending_payment' = 'confirmed'
     let subscriptionId = next.subscriptionId
     let confirmedAt: Date | null = new Date()

     if (next.method === 'subscription') {
       // Списываем сессию при промоушене
       try {
         const consumed = await subscriptionService.consumeSession(
           { userId: next.userId, db }, next.organizationId, next.subscriptionId ?? undefined,
         )
         subscriptionId = consumed.subscriptionId
       } catch (e) {
         if (e instanceof NoActiveSubscriptionError) {
           // Сессий нет — продвигаем в pending_payment (игрок доплатит другим способом)
           status = 'pending_payment'
           subscriptionId = null
           confirmedAt = null
         } else {
           throw e
         }
       }
     } else if (next.method === 'free') {
       status = 'confirmed'
     } else {
       // cash/transfer/online — был pending в waitlist, остаётся pending_payment но теперь "в составе"
       // Слот закреплён (confirmed по смыслу), оплата отдельно (Phase 6)
       status = 'pending_payment'
       confirmedAt = null
     }

     const [promoted] = await db.update(bookings).set({
       status, subscriptionId, confirmedAt, updatedAt: new Date(),
       // bookedAt НЕ меняем — сохраняем историю порядка
     }).where(eq(bookings.id, next.id)).returning()

     return promoted!
   },
   ```

2. **Тесты:**
   ```ts
   test('promotion moves first waitlisted to confirmed (FIFO)', async () => {})
   test('promotion with subscription consumes session', async () => {})
   test('promotion with exhausted subscription → pending_payment', async () => {})
   test('promotion of cash booking → pending_payment (slot secured)', async () => {})
   test('no promotion when waitlist empty', async () => {})
   test('chain: cancel → promote → cancel promoted → promote next', async () => {})
   ```

## Критерии приёмки

- ✅ Первый waitlisted (по bookedAt ASC) продвигается
- ✅ method=subscription → consume при промоушене, status=confirmed
- ✅ subscription исчерпан при промоушене → pending_payment (не теряем игрока)
- ✅ method=free → confirmed
- ✅ method=cash/transfer → pending_payment (слот закреплён, оплата в Phase 6)
- ✅ Waitlist пуст → null
- ✅ bookedAt сохраняется (порядок очереди)
- ✅ Chain promotion работает (отмена promoted → следующий)

## Подсказки

- **Почему consume при промоушене, а не при waitlist-записи:** иначе сессия «заморожена» в waitlist неопределённо долго. Списываем только когда реально попал в состав.
- **Exhausted при промоушене → pending_payment:** игрок встал в waitlist с абонемента, но к моменту промоушена сессии кончились (потратил на другое событие). Не выкидываем — даём доплатить (pending_payment, разрешится в Phase 6 или игрок отменит).
- **bookedAt не трогаем:** если promoted потом отменит, и нужно promote следующего — порядок по bookedAt сохранён корректно.
- **Один слот = один promote:** освободился 1 confirmed → продвигаем 1. Не несколько.

## Не делать

- ❌ Не делать TTL-подтверждение — Phase 15 (synchronous пока)
- ❌ Не уведомлять promoted — Phase 8
- ❌ Не продвигать несколько за раз
- ❌ Не менять bookedAt
