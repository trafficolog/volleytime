---
id: '6.1.4'
phase: '6'
epic: '6.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '6.1.3'
  - '5.6.1'
estimated_hours: '1-2'
tags:
  - service
  - payments
  - refund
---

# Task 6.1.4: PaymentService cancel + refund

## Цель

`cancel` — отклонить pending payment (booking отменяется). `refund` — вернуть succeeded payment (ledger expense). Append-only.

## Контекст

Cancel (reject): организатор отклоняет pending-платёж (игрок не заплатил) → booking cancelled (+ promotion). Refund: возврат уже succeeded платежа (при mass refund отмены события 6.4) → ledger expense.

Решение 2: refunded — отдельный статус, append-only (succeeded не редактируется, переход succeeded→refunded + корректирующая ledger запись).

## Что должно быть сделано

1. **`service.ts` — cancel:**

   ```ts
   import { bookingService } from '../bookings'

   /**
    * Отклонить pending payment. Booking отменяется (+ promotion).
    */
   async cancel(ctx: ServiceContext, paymentId: number) {
     const db = getDb(ctx)
     return await db.transaction(async (tx) => {
       const payment = await paymentRepository.getById(tx, paymentId)
       if (!payment) throw new PaymentNotFoundError(paymentId)
       if (payment.status !== 'pending') throw new PaymentNotPendingError()

       const cancelled = await paymentRepository.update(tx, paymentId, { status: 'cancelled' })

       // Если booking — отменяем (освобождает слот, promotion)
       if (payment.bookingId) {
         await bookingService.cancel({ ...ctx, db: tx }, payment.bookingId, { byAdmin: true })
       }
       // Если subscription pending — отменяем
       if (payment.subscriptionId) {
         await tx.update(subscriptions).set({ status: 'cancelled', updatedAt: new Date() })
           .where(eq(subscriptions.id, payment.subscriptionId))
       }

       return cancelled
     })
   }
   ```

2. **`service.ts` — refund:**

   ```ts
   import { PaymentNotSucceededError } from './errors'
   import { ledgerService } from '../ledger'

   /**
    * Вернуть succeeded payment. Создаёт ledger expense (refund).
    * Append-only: payment succeeded → refunded, корректирующая запись в ledger.
    * Вызывается при mass refund (6.4) или вручную организатором.
    */
   async refund(ctx: ServiceContext, paymentId: number, opts: { reason?: string } = {}) {
     const db = getDb(ctx)
     return await db.transaction(async (tx) => {
       const payment = await paymentRepository.getById(tx, paymentId)
       if (!payment) throw new PaymentNotFoundError(paymentId)
       if (payment.status !== 'succeeded') throw new PaymentNotSucceededError()

       const refunded = await paymentRepository.update(tx, paymentId, {
         status: 'refunded',
         refundedAt: new Date(),
       })

       // Корректирующая ledger запись (expense refund)
       await ledgerService.createEntry({ ...ctx, db: tx }, {
         organizationId: payment.organizationId,
         type: 'expense',
         category: 'refund',
         amount: payment.amount,
         currency: payment.currency,
         paymentId: payment.id,
         description: opts.reason ?? 'Возврат оплаты',
       })

       return refunded
     })
   }
   ```

3. **Тесты:**
   ```ts
   test('cancel pending payment → cancelled + booking cancelled', async () => {})
   test('cancel pending subscription payment → subscription cancelled', async () => {})
   test('cancel non-pending → PaymentNotPendingError', async () => {})
   test('refund succeeded → refunded + ledger expense', async () => {})
   test('refund non-succeeded → PaymentNotSucceededError', async () => {})
   test('refund ledger expense amount matches payment', async () => {})
   test('cancel booking payment triggers waitlist promotion', async () => {})
   ```

## Критерии приёмки

- ✅ cancel pending booking payment → Payment cancelled, booking cancelled (+ promotion через bookingService.cancel byAdmin)
- ✅ cancel pending subscription payment → Payment cancelled, subscription cancelled
- ✅ cancel non-pending → PaymentNotPendingError
- ✅ refund succeeded → Payment refunded + LedgerEntry expense (refund категория)
- ✅ refund non-succeeded → PaymentNotSucceededError
- ✅ refund amount == payment amount
- ✅ Append-only: succeeded переходит в refunded, не удаляется; ledger корректирующая запись
- ✅ Всё атомарно

## Подсказки

- **cancel vs refund:** cancel — отклонение неоплаченного (pending), деньги не получены. refund — возврат полученного (succeeded), деньги физически возвращаются (ledger expense фиксирует).
- **cancel booking через bookingService.cancel byAdmin** (5.6.1) — освобождает слот, триггерит promotion. Передаём tx.
- **refund вызывается из 6.4** (mass refund отмены события) для каждого succeeded payment.
- **Ledger expense refund** уменьшает баланс кассы (организатор вернул деньги).

## Не делать

- ❌ Не редактировать succeeded payment напрямую (только статус → refunded + ledger)
- ❌ Не делать частичный refund — полная сумма
- ❌ Не делать refund для self-cancel игрока (решение 9: ручное через кассу) — refund только при mass refund/ручном решении организатора
- ❌ Не уведомлять — Phase 8
