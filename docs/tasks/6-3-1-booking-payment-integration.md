---
id: '6.3.1'
phase: '6'
epic: '6.3'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '6.1.2'
  - '5.3.2'
estimated_hours: '1-2'
tags:
  - integration
  - bookings
  - payments
---

# Task 6.3.1: Booking → Payment integration (cash/transfer)

## Цель

Расширить bookingService.book: при method cash/transfer создавать Payment(pending) через paymentService, связывать booking.payment_id. Внутри той же транзакции.

## Контекст

В Phase 5 (5.3.2) cash/transfer booking создавал pending_payment, но без Payment-записи (заглушка). Теперь создаём реальный Payment, чтобы организатор мог подтвердить через кассу.

## Что должно быть сделано

1. **Обновить bookingService.book (5.3.2)** — после создания booking с pending_payment:

   ```ts
   import { paymentService } from '../payments'

   // в book(), после insert booking, если status === 'pending_payment' и method cash/transfer:
   if (status === 'pending_payment' && (method === 'cash' || method === 'transfer')) {
     const payment = await paymentService.createForBooking(
       { userId: ctx.userId, db: tx },
       {
         organizationId: orgId,
         userId: ctx.userId,
         bookingId: created.id,
         amount: event.price,
         currency: event.currency,
         method,
       },
     )
     // связать booking.payment_id
     await tx.update(bookings).set({ paymentId: payment.id }).where(eq(bookings.id, created.id))
     created.paymentId = payment.id
   }
   ```

2. **Учесть reactivation** (cancelled booking → rebook): если был старый payment (cancelled), создаётся новый. Старый payment остаётся cancelled (append-only).

3. **Waitlisted cash booking:** в Phase 5 (5.3.2) waitlisted не создавал payment? Уточнение: waitlisted booking с cash — payment создаётся при promotion (5.6.2), не при waitlist-записи. Проверить: book() создаёт payment только для pending_payment (confirmed слот, ждёт оплаты), не для waitlisted. При promotion cash booking → pending_payment, тогда payment создаётся в promoteFromWaitlist.

4. **Обновить promoteFromWaitlist (5.6.2)** — при промоушене cash/transfer в pending_payment создать Payment:

   ```ts
   // в promoteFromWaitlist, если promoted status === 'pending_payment' (cash/transfer):
   if (status === 'pending_payment' && (next.method === 'cash' || next.method === 'transfer')) {
     const payment = await paymentService.createForBooking(
       { userId: next.userId, db },
       {
         organizationId: next.organizationId,
         userId: next.userId,
         bookingId: next.id,
         amount: event.price,
         currency: event.currency,
         method: next.method,
       },
     )
     // связать
     await db.update(bookings).set({ paymentId: payment.id }).where(eq(bookings.id, next.id))
   }
   ```

   (требует загрузки event в promoteFromWaitlist для amount/currency — добавить)

5. **Тесты:**
   ```ts
   test('cash booking creates pending Payment linked to booking', async () => {})
   test('transfer booking creates pending Payment', async () => {})
   test('free booking does NOT create Payment', async () => {})
   test('subscription booking does NOT create Payment', async () => {})
   test('promoted cash booking creates Payment', async () => {})
   test('rebook after cancel creates new Payment (old stays cancelled)', async () => {})
   ```

## Критерии приёмки

- ✅ cash/transfer booking (pending_payment) → Payment(pending) создан, booking.payment_id связан
- ✅ free booking → без Payment
- ✅ subscription booking → без Payment (оплата сессией)
- ✅ Payment amount = event.price, currency = event.currency
- ✅ Promoted cash/transfer booking → Payment создан при промоушене
- ✅ Reactivation: новый Payment, старый остаётся cancelled
- ✅ Всё в транзакции book()/promote()

## Подсказки

- **Payment только для pending_payment, не waitlisted:** waitlisted ещё не в составе, оплата не нужна. При промоушене (попал в состав) cash → pending_payment → создаём Payment.
- **promoteFromWaitlist нужен event** для amount/currency — добавить загрузку event в начале (если ещё нет).
- **free/subscription не создают Payment** — у них нет денежного долга (free) или оплата сессией (subscription).

## Не делать

- ❌ Не создавать Payment для free/subscription
- ❌ Не создавать Payment для waitlisted (только при промоушене в pending_payment)
- ❌ Не делать online — Phase 12
