---
id: '15.5.1'
phase: '15'
epic: '15.5'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: 'Заменяет авто-promotion Phase 5 на offer-логику.'
roles:
  - BACK
depends_on:
  - '15.1.1'
  - '5.6.2'
estimated_hours: '2'
tags:
  - waitlist
  - confirm-flow
  - bookings
---

# Task 15.5.1: Booking offered-состояние + offer логика (вместо авто-promote)

## Цель

Заменить авто-promotion (5.6.2): вместо мгновенного перевода первого из waitlist в состав — состояние «offered» (место зарезервировано на 30 мин) + offer первому в очереди. Регистрация TTL-задачи.

## Контекст

Решение 6: confirm-flow вместо авто. Освободилось место → не promote вслепую, а offer первому (резерв 30 мин). Меняет bookingService.promoteFromWaitlist.

## Что должно быть сделано

1. **Booking offered-состояние** — МИГРАЦИЯ booking status enum + новое поле:

   ```ts
   // МИГРАЦИЯ: добавить 'offered' в bookingStatusEnum (5.3.1).
   // Текущий enum (5.3.1): pending_payment, confirmed, waitlisted, attended, no_show, cancelled
   // Добавить: 'offered' — место зарезервировано, ждём подтверждения (между waitlisted и confirmed)
   // ALTER TYPE booking_status ADD VALUE 'offered';

   // bookings schema — добавить поле:
   offerExpiresAt: timestamp('offer_expires_at', { withTimezone: true }),
   ```

   Новый статус `offered` (между waitlisted и confirmed). Место зарезервировано на 30 мин, ждём подтверждения. Требует drizzle-миграцию (ALTER enum + ADD COLUMN).

2. **Заменить promoteFromWaitlist (5.6.2):**

   ```ts
   /**
    * Место освободилось. НЕ авто-promote, а offer первому в waitlist.
    * Резервирует место (offered), ставит TTL-задачу (30 мин).
    */
   async offerToWaitlist(ctx, eventId: number) {
     const db = getDb(ctx)
     // первый в waitlist (FIFO) — без активного offer
     const next = await db.query.bookings.findFirst({
       where: and(eq(bookings.eventId, eventId), eq(bookings.status, 'waitlisted')),
       orderBy: (b, { asc }) => [asc(b.createdAt)],
     })
     if (!next) return null  // waitlist пуст — место свободно

     const offerExpiresAt = new Date(Date.now() + 30 * 60_000)  // 30 мин
     await db.update(bookings).set({
       status: 'offered', offerExpiresAt, updatedAt: new Date(),
     }).where(eq(bookings.id, next.id))

     // TTL-задача (15.5.3) на истечение offer
     await scheduleWaitlistOfferTtl(eventId, next.id, offerExpiresAt)

     // уведомление-предложение (15.5.3) — критичное, через очередь (15.7)
     await notifierService.sendReliable(next.userId, 'waitlist_offer', {
       eventTitle: event.title, eventId, bookingId: next.id,
       expiresMinutes: 30,
     })

     return next
   }
   ```

3. **Capacity-учёт offered:** offered занимает место (резерв). Подсчёт свободных мест = capacity − confirmed − pending_payment − **offered**. Обновить capacity-логику (5.3.x) чтобы offered считался занятым.

4. **Точки вызова offerToWaitlist** — где раньше был promoteFromWaitlist:
   - bookingService.cancel (5.6.1) — игрок отменился → offer следующему
   - paymentService.cancel (6.1.4) — pending отменён → offer
   - НЕ при mass cancel (6.4.1 — событие целиком отменяется)

5. **Один активный offer на место** — не предлагать нескольким сразу. FIFO по очереди.

6. **Тесты:**
   ```ts
   test('freed slot offers to first waitlist (not auto-promote)', async () => {})
   test('offered booking reserves slot (capacity counts it)', async () => {})
   test('offer sets offerExpiresAt 30min', async () => {})
   test('empty waitlist → slot stays free', async () => {})
   test('offer is FIFO (oldest waitlist first)', async () => {})
   ```

## Критерии приёмки

- ✅ Booking offered-статус (миграция enum 5.3.1) + offerExpiresAt поле
- ✅ offerToWaitlist заменяет авто-promote (5.6.2)
- ✅ Offer первому в waitlist (FIFO), резерв 30 мин
- ✅ offered считается занятым местом (capacity)
- ✅ TTL-задача регистрируется (15.5.3)
- ✅ Уведомление-предложение (sendReliable, 15.7)
- ✅ Пустой waitlist → место свободно
- ✅ Один offer на место (не нескольким)
- ✅ Тесты

## Подсказки

- **offered резервирует место** — критично для capacity. Иначе пока ждём подтверждения, место покажется свободным и кто-то ещё запишется. offered = занято (временно).
- **FIFO** — справедливость: первый в очереди получает первое предложение.
- **Замена promoteFromWaitlist** — все вызовы старого promote → offerToWaitlist. Кроме mass cancel (там событие отменяется, offer не нужен).
- **sendReliable (15.7)** — предложение критично (от него зависит попадёт ли игрок). Через очередь с retry, не fire-and-forget.

## Не делать

- ❌ Не оставлять авто-promotion
- ❌ Не предлагать нескольким одновременно
- ❌ Не показывать offered место свободным (capacity)
- ❌ Не offer при mass cancel события
