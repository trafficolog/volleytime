---
id: '6.1.3'
phase: '6'
epic: '6.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
depends_on:
  - '6.1.2'
  - '6.2.1'
  - '5.5.2'
estimated_hours: '2-3'
tags:
  - service
  - payments
  - core
---

# Task 6.1.3: PaymentService confirm (атомарно + side effects)

## Цель

`paymentService.confirm` — подтверждение оплаты организатором. Атомарно: Payment→succeeded + side effect (booking→confirmed / subscription→active) + LedgerEntry income.

## Контекст

Из Python-прототипа: Payment.confirm как single source of truth. Подтверждение замыкает контур — деньги зафиксированы, сущность активирована.

Решение 4: атомарно; если booking к моменту confirm не pending_payment — payment всё равно succeeded, booking не трогаем (деньги получены).

## Что должно быть сделано

1. **`service.ts` — confirm:**

   ```ts
   import { bookings, subscriptions } from '@volley-time/db'
   import { eq } from 'drizzle-orm'
   import { PaymentNotPendingError } from './errors'
   import { subscriptionService } from '../subscriptions'
   import { ledgerService } from '../ledger'

   /**
    * Подтвердить оплату. Атомарно:
    *   1. Payment → succeeded
    *   2. Side effect: booking → confirmed ИЛИ subscription → active
    *   3. LedgerEntry income
    * Если booking уже не pending_payment — payment succeeded, booking не трогаем.
    */
   async confirm(ctx: ServiceContext, paymentId: number) {
     const db = getDb(ctx)

     return await db.transaction(async (tx) => {
       const payment = await paymentRepository.getById(tx, paymentId)
       if (!payment) throw new PaymentNotFoundError(paymentId)
       if (payment.status !== 'pending') throw new PaymentNotPendingError()

       // 1. Payment → succeeded
       const succeeded = await paymentRepository.update(tx, paymentId, {
         status: 'succeeded',
         confirmedByUserId: ctx.userId,
         confirmedAt: new Date(),
       })

       // 2. Side effect
       if (payment.bookingId) {
         const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, payment.bookingId) })
         // Решение 4: трогаем только если ещё pending_payment
         if (booking && booking.status === 'pending_payment') {
           await tx.update(bookings).set({
             status: 'confirmed', confirmedAt: new Date(), updatedAt: new Date(),
           }).where(eq(bookings.id, payment.bookingId))
         }
         // если booking cancelled/waitlisted/etc — payment всё равно succeeded, booking не трогаем
       } else if (payment.subscriptionId) {
         const sub = await tx.query.subscriptions.findFirst({ where: eq(subscriptions.id, payment.subscriptionId) })
         if (sub && sub.status === 'pending') {
           await subscriptionService.activate({ userId: payment.userId, db: tx }, payment.subscriptionId)
         }
       }

       // 3. LedgerEntry income
       await ledgerService.createEntry({ userId: ctx.userId, db: tx }, {
         organizationId: payment.organizationId,
         type: 'income',
         category: 'payment_income',
         amount: payment.amount,
         currency: payment.currency,
         paymentId: payment.id,
         description: payment.bookingId ? 'Оплата участия' : 'Оплата абонемента',
       })

       return succeeded
     })
   }
   ```

2. **Тесты** (`__tests__/confirm.integration.test.ts`):
   ```ts
   test('confirm booking payment → booking confirmed + ledger income', async () => {})
   test('confirm subscription payment → subscription active + ledger income', async () => {})
   test('confirm when booking already cancelled → payment succeeded, booking untouched, ledger income', async () => {})
   test('confirm non-pending payment → PaymentNotPendingError', async () => {})
   test('confirm sets confirmedByUserId and confirmedAt', async () => {})
   test('ledger income amount matches payment amount', async () => {})
   ```

## Критерии приёмки

- ✅ confirm booking payment: Payment→succeeded, booking pending_payment→confirmed, LedgerEntry income
- ✅ confirm subscription payment: Payment→succeeded, subscription pending→active (activate), LedgerEntry income
- ✅ booking уже не pending_payment (cancelled/waitlisted) → payment succeeded, booking НЕ тронут, ledger income создан
- ✅ confirm не-pending payment → PaymentNotPendingError
- ✅ confirmedByUserId = кто подтвердил, confirmedAt установлен
- ✅ Всё атомарно (одна транзакция)
- ✅ Ledger income amount == payment amount

## Подсказки

- **Решение 4 нюанс:** деньги физически получены организатором, поэтому payment succeeded в любом случае. Booking трогаем только если ещё ждёт (pending_payment). Если игрок успел отмениться — деньги в кассе, разрулится refund'ом вручную.
- **subscriptionService.activate** (5.5.2) рассчитает expiresAt из validityDays плана. Передаём tx.
- **ledgerService.createEntry** (6.2.1) — income категория payment_income, ссылка на payment для трассировки.
- **Транзакция:** payment + side effect + ledger атомарны. Сбой любого → rollback всего.

## Не делать

- ❌ Не делать уведомление игроку — Phase 8
- ❌ Не делать повторный confirm (idempotency через PaymentNotPendingError)
- ❌ Не трогать booking если он не pending_payment
