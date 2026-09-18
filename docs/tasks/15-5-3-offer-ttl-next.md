---
id: '15.5.3'
phase: '15'
epic: '15.5'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '15.5.1'
  - '15.5.2'
estimated_hours: '1-2'
tags:
  - waitlist
  - confirm-flow
  - ttl
---

# Task 15.5.3: TTL offer (30мин) → следующий + waitlist_offer уведомление

## Цель

TTL-задача waitlist.offer_ttl: если offer не подтверждён за 30 мин → снять offer (вернуть в waitlist или отменить), предложить следующему. Завершает confirm-flow.

## Контекст

Решение 6: не подтвердил за 30 мин → следующему. Handler проверяет offer ещё активен (не подтверждён), переводит дальше по очереди.

## Что должно быть сделано

1. **Планирование TTL (15.5.1 вызывает):**

   ```ts
   import { schedule } from '@volley-time/jobs'
   export async function scheduleWaitlistOfferTtl(
     eventId: number,
     bookingId: number,
     expiresAt: Date,
   ) {
     return schedule(
       JOB_TYPES.WAITLIST_OFFER_TTL,
       { eventId, bookingId },
       expiresAt,
       `waitlist-offer-${bookingId}`,
     )
   }
   export async function cancelWaitlistOfferTtl(eventId: number, bookingId: number) {
     await cancelJobByKey(`waitlist-offer-${bookingId}`) // или по сохранённому jobId
   }
   ```

2. **TTL handler `apps/bot/src/jobs/handlers/waitlist-offer.ts`:**

   ```ts
   export const waitlistOfferTtlJob = defineJob<WaitlistOfferPayload>(
     JOB_TYPES.WAITLIST_OFFER_TTL,
     async ({ eventId, bookingId }) => {
       await db.transaction(async (tx) => {
         const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
         // актуальность: всё ещё offered? (мог подтвердить → не offered → пропуск)
         if (!booking || booking.status !== 'offered') return

         // offer истёк без подтверждения → вернуть в waitlist (или cancelled)
         await tx
           .update(bookings)
           .set({
             status: 'waitlisted', // вернулся в конец? или остаётся в очереди?
             offerExpiresAt: null,
             updatedAt: new Date(),
           })
           .where(eq(bookings.id, bookingId))
         // решение: вернуть в waitlist (в конец — упустил шанс) или убрать.
         // Проще: остаётся waitlisted, но offer уходит следующему (не ему повторно сразу)

         // уведомить что offer истёк (опц)
         // ... notifier waitlist_offer_expired ...

         // предложить следующему (offerToWaitlist пропустит уже-offered/только что вернувшегося)
         await bookingService.offerToWaitlist({ ...systemCtx, db: tx }, eventId)
       })
     },
   )
   ```

3. **Что с истёкшим offer** — варианты:
   - (A) Вернуть в waitlist в конец очереди (упустил — жди снова)
   - (B) Остаётся waitlisted на своём месте, но offer идёт следующему (не зацикливаемся на нём)
   - (C) Убрать из waitlist (отказался)

   Выбрать **B** с защитой от зацикливания: вернувшийся waitlisted, но offerToWaitlist должен предложить СЛЕДУЮЩЕМУ, не ему снова. Отметка «offer был предложен» (lastOfferedAt) чтобы не зациклить. Или проще — A (в конец очереди).

   Рекомендация в задаче: **A** (в конец очереди) — просто, без зацикливания, справедливо (упустил предложение → в конец).

   ```ts
   // вернуть в waitlist с новым createdAt-порядком (в конец) ИЛИ
   // флаг offerDeclinedAt чтобы offerToWaitlist его пропускал до новых освобождений
   ```

4. **offerToWaitlist пропускает только что истёкших** — иначе зациклится (предложит снова тому же). Через сортировку (вернулся в конец) или флаг.

5. **Уведомление следующему** — offerToWaitlist (15.5.1) уже шлёт waitlist_offer. Цепочка продолжается.

6. **Тесты:**
   ```ts
   test('offer TTL expires → offer goes to next in waitlist', async () => {})
   test('expired offer booking returns to waitlist (end of queue)', async () => {})
   test('confirmed before TTL → TTL handler no-op', async () => {})
   test('TTL with empty remaining waitlist → slot free', async () => {})
   test('no infinite loop (expired not re-offered immediately)', async () => {})
   ```

## Критерии приёмки

- ✅ waitlist.offer_ttl задача (30 мин) регистрируется при offer (15.5.1)
- ✅ TTL handler: offered не подтверждён → снять offer, предложить следующему
- ✅ Истёкший возвращается в waitlist (в конец очереди — вариант A)
- ✅ offerToWaitlist предлагает следующему (не зацикливается на истёкшем)
- ✅ Подтверждён до TTL → handler no-op (status не offered)
- ✅ Пустой остаток waitlist → место свободно
- ✅ Нет бесконечного цикла
- ✅ Тесты

## Подсказки

- **Зацикливание — главный риск.** Истёк offer → предложить следующему, НЕ тому же снова. Вариант A (в конец очереди по createdAt/новому порядку) или флаг lastOfferedAt. Без этого — вечный цикл одному человеку.
- **Актуальность в handler** — между планированием TTL и срабатыванием игрок мог подтвердить (status confirmed) → handler видит не offered → no-op. Race решается проверкой.
- **Снятие TTL при confirm (15.5.2)** + проверка актуальности здесь = двойная защита от race.
- **Цепочка через offerToWaitlist** — handler зовёт offerToWaitlist, который предложит следующему и поставит новый TTL. Рекурсивная цепочка по очереди.

## Не делать

- ❌ Не зацикливать на истёкшем (в конец/флаг)
- ❌ Не переводить если уже подтверждён (актуальность)
- ❌ Не оставлять место занятым после истечения (offer снят)
