---
id: '6.1.2'
phase: '6'
epic: '6.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
depends_on:
  - '6.1.1'
estimated_hours: '1-2'
tags:
  - service
  - payments
---

# Task 6.1.2: PaymentService create (booking/subscription)

## Цель

Модуль `payments/` + методы создания Payment: createForBooking, createForSubscription. Валидация polymorphic.

## Контекст

Payment создаётся когда возникает «долг»: cash/transfer booking (6.3.1) или покупка платного абонемента (6.3.2). Эти методы вызываются из bookingService/subscriptionService внутри их транзакций.

## Что должно быть сделано

1. **Модуль `apps/web/modules/payments/`** (service, repository, schemas, errors, index).

2. **`errors.ts`:**

   ```ts
   export class PaymentError extends Error {
     code: string
     constructor(code: string, message: string) {
       super(message)
       this.code = code
       this.name = 'PaymentError'
     }
   }
   export class PaymentNotFoundError extends PaymentError {
     constructor(id: number | string) {
       super('payment.not_found', `Payment ${id} not found`)
     }
   }
   export class PaymentNotPendingError extends PaymentError {
     constructor() {
       super('payment.not_pending', 'Payment is not pending')
     }
   }
   export class PaymentNotSucceededError extends PaymentError {
     constructor() {
       super('payment.not_succeeded', 'Payment is not succeeded (cannot refund)')
     }
   }
   export class InvalidPaymentTargetError extends PaymentError {
     constructor() {
       super(
         'payment.invalid_target',
         'Payment must reference exactly one of booking or subscription',
       )
     }
   }
   ```

3. **`repository.ts`:**

   ```ts
   import type { DB } from '@volley-time/db'
   import { payments, type Payment, type NewPayment } from '@volley-time/db'
   import { eq, and } from 'drizzle-orm'

   export const paymentRepository = {
     async create(db: DB, data: NewPayment): Promise<Payment> {
       const [p] = await db.insert(payments).values(data).returning()
       if (!p) throw new Error('Failed to create payment')
       return p
     },
     async getById(db: DB, id: number): Promise<Payment | null> {
       return (await db.query.payments.findFirst({ where: eq(payments.id, id) })) ?? null
     },
     async listPending(db: DB, orgId: number): Promise<Payment[]> {
       return db.query.payments.findMany({
         where: and(eq(payments.organizationId, orgId), eq(payments.status, 'pending')),
         with: {
           user: true,
           booking: { with: { event: true } },
           subscription: { with: { plan: true } },
         },
         orderBy: (p, { asc }) => [asc(p.createdAt)],
       })
     },
     async update(db: DB, id: number, data: Partial<NewPayment>): Promise<Payment> {
       const [p] = await db.update(payments).set(data).where(eq(payments.id, id)).returning()
       if (!p) throw new Error(`Payment ${id} not found`)
       return p
     },
   }
   ```

4. **`service.ts` — create методы:**

   ```ts
   import { getDb, type ServiceContext } from '../shared/context'
   import { paymentRepository } from './repository'
   import { InvalidPaymentTargetError } from './errors'

   export const paymentService = {
     /**
      * Создать pending payment для booking (cash/transfer).
      * Вызывается из bookingService.book внутри транзакции (ctx.db = tx).
      */
     async createForBooking(
       ctx: ServiceContext,
       params: {
         organizationId: number
         userId: number
         bookingId: number
         amount: number
         currency: string
         method: 'cash' | 'transfer'
       },
     ) {
       const db = getDb(ctx)
       return paymentRepository.create(db, {
         organizationId: params.organizationId,
         userId: params.userId,
         bookingId: params.bookingId,
         subscriptionId: null,
         amount: params.amount,
         currency: params.currency,
         method: params.method,
         status: 'pending',
       })
     },

     /**
      * Создать pending payment для subscription (платный план).
      * Вызывается из subscriptionService.createFromPlan внутри транзакции.
      */
     async createForSubscription(
       ctx: ServiceContext,
       params: {
         organizationId: number
         userId: number
         subscriptionId: number
         amount: number
         currency: string
         method: 'cash' | 'transfer'
       },
     ) {
       const db = getDb(ctx)
       return paymentRepository.create(db, {
         organizationId: params.organizationId,
         userId: params.userId,
         bookingId: null,
         subscriptionId: params.subscriptionId,
         amount: params.amount,
         currency: params.currency,
         method: params.method,
         status: 'pending',
       })
     },

     async listPending(ctx: ServiceContext, orgId: number) {
       return paymentRepository.listPending(getDb(ctx), orgId)
     },

     async getById(ctx: ServiceContext, id: number) {
       const p = await paymentRepository.getById(getDb(ctx), id)
       if (!p) throw new PaymentNotFoundError(id)
       return p
     },
   }
   ```

5. **`index.ts`** — публичный экспорт.

## Критерии приёмки

- ✅ createForBooking создаёт Payment(pending) с booking_id, subscription_id=null
- ✅ createForSubscription создаёт Payment(pending) с subscription_id, booking_id=null
- ✅ amount/currency/method сохраняются
- ✅ listPending возвращает pending org с enrichment (user, booking+event / subscription+plan)
- ✅ Сортировка pending по createdAt (старые первыми)
- ✅ getById → PaymentNotFoundError если нет
- ✅ Методы работают внутри транзакции (ctx.db = tx)

## Подсказки

- **Вызов внутри транзакции:** createForBooking/Subscription получают tx из вызывающего сервиса (bookingService/subscriptionService в 6.3). Payment и booking/subscription создаются атомарно.
- **enrichment в listPending** — UI (6.5) показывает «Игрок X, событие Y, 15 BYN». Подгружаем связи разом.
- **confirm/cancel/refund** — в 6.1.3/6.1.4.

## Не делать

- ❌ Не делать confirm здесь — 6.1.3
- ❌ Не создавать payment для free (price=0) — booking/subscription идут free flow
- ❌ Не делать online method — Phase 12
