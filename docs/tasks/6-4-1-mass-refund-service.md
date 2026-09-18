---
id: '6.4.1'
phase: '6'
epic: '6.4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 6.8.'
roles:
  - BACK
depends_on:
  - '6.1.4'
  - '5.6.1'
  - '5.5.4'
estimated_hours: '2'
tags:
  - service
  - events
  - refund
  - core
---

# Task 6.4.1: eventService.cancelWithRefund (mass refund логика)

## Цель

Расширить eventService.cancel (заглушка из 5.2.2): при отмене события транзакционно обработать все активные брони — restore сессий, refund succeeded payments, cancel pending payments, отменить брони.

## Контекст

5.2.2 cancel просто менял статус с пометкой «mass refund — Phase 6». Решение 8: автоматический mass refund. Для каждой не-cancelled брони события применяем правильную обработку по методу/статусу оплаты.

## Что должно быть сделано

1. **Обновить eventService.cancel (5.2.2)** — добавить mass refund:

   ```ts
   import { paymentService } from '../payments'
   import { subscriptionService } from '../subscriptions'
   import { bookings, payments } from '@volley-time/db'
   import { eq, and, ne } from 'drizzle-orm'

   async cancel(ctx: ServiceContext, eventId: number) {
     const db = getDb(ctx)
     return await db.transaction(async (tx) => {
       const event = await this.getById({ ...ctx, db: tx }, eventId)
       if (event.status === 'cancelled') return event  // idempotent

       // Все активные брони (не cancelled)
       const activeBookings = await tx.query.bookings.findMany({
         where: and(eq(bookings.eventId, eventId), ne(bookings.status, 'cancelled')),
       })

       for (const b of activeBookings) {
         // 1. Restore subscription session (если был)
         if (b.subscriptionId) {
           await subscriptionService.restoreSession({ userId: b.userId, db: tx }, b.subscriptionId)
         }

         // 2. Payment handling
         if (b.paymentId) {
           const payment = await tx.query.payments.findFirst({ where: eq(payments.id, b.paymentId) })
           if (payment?.status === 'succeeded') {
             // Оплачено → refund (ledger expense)
             await paymentService.refund({ ...ctx, db: tx }, payment.id, { reason: 'Отмена события' })
           } else if (payment?.status === 'pending') {
             // Не оплачено → cancel payment
             await paymentService.cancel({ ...ctx, db: tx }, payment.id)
             // NOTE: paymentService.cancel сам отменит booking — учесть двойную отмену ниже
           }
         }

         // 3. Booking → cancelled (если ещё не отменён payment.cancel'ом)
         const fresh = await tx.query.bookings.findFirst({ where: eq(bookings.id, b.id) })
         if (fresh && fresh.status !== 'cancelled') {
           await tx.update(bookings).set({
             status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date(),
           }).where(eq(bookings.id, b.id))
         }
       }

       // 4. Event → cancelled
       return eventRepository.update(tx, eventId, { status: 'cancelled' })
       // NOTE: НЕ вызываем promotion — событие отменено целиком
     })
   }
   ```

2. **Важно — отключить promotion при mass cancel:** обычный bookingService.cancel триггерит promotion. Здесь событие отменяется целиком — promotion не нужен (некуда продвигать). Поэтому отменяем брони напрямую (update status), НЕ через bookingService.cancel. Исключение — paymentService.cancel внутри может вызвать bookingService.cancel; для mass refund это создаёт лишний promotion. Решение: в mass refund отменять payment без booking-cascade, либо принять что promotion на отменяемом событии безвреден (waitlist тоже отменяется). Проще: обрабатывать payment.cancel напрямую (update status cancelled) без booking-cascade в контексте mass refund.

   Уточнённый подход — отдельный internal-метод:

   ```ts
   // paymentService internal: cancel без booking-cascade (для mass refund)
   async cancelPaymentOnly(ctx, paymentId) {
     return paymentRepository.update(getDb(ctx), paymentId, { status: 'cancelled' })
   }
   ```

   В mass refund использовать cancelPaymentOnly + явный booking update (брони и так все отменяются в цикле).

3. **Audit:** event.cancelled с summary (сколько броней, refund сумма).

## Критерии приёмки

- ✅ Отмена события обрабатывает ВСЕ не-cancelled брони
- ✅ subscription bookings → restoreSession (used уменьшается)
- ✅ succeeded payments → refund (ledger expense)
- ✅ pending payments → cancelled (без денег)
- ✅ Все брони → cancelled
- ✅ Event → cancelled
- ✅ Promotion НЕ запускается (событие целиком отменено)
- ✅ Idempotent (повторная отмена безопасна)
- ✅ Всё в одной транзакции

## Подсказки

- **Promotion не нужен при mass cancel** — некуда продвигать, всё событие отменяется. Отменяем брони напрямую (update), не через bookingService.cancel (который триггерит promotion).
- **cancelPaymentOnly** — internal метод для mass refund, без booking-cascade (брони отменяются явно в цикле). Избегает двойной логики.
- **restoreSession для subscription** — игрок получает сессию обратно (событие отменено не по его вине).
- **refund для succeeded** — ledger expense, баланс кассы уменьшается (организатор возвращает деньги).

## Не делать

- ❌ Не запускать promotion при mass cancel
- ❌ Не уведомлять игроков — Phase 8
- ❌ Не делать partial cancel (отдельные брони) — это обычный booking cancel
- ❌ Не трогать уже cancelled брони
