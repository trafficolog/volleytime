---
id: '6.3.2'
phase: '6'
epic: '6.3'
status: todo
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Не реализовано в v0.1.0 (ревью 2026-09-16); закрывается фикс-эпиком 6.8.'
roles:
  - BACK
depends_on:
  - '6.1.2'
  - '5.5.2'
  - '5.7.2'
estimated_hours: '1-2'
tags:
  - integration
  - subscriptions
  - payments
---

# Task 6.3.2: Subscription → Payment integration (платные планы)

## Цель

Расширить subscriptionService.createFromPlan: платный план (price > 0) → создать Payment(pending), subscription остаётся pending (без autoActivate). Бесплатный (price = 0) → autoActivate как раньше.

## Контекст

Решение 10: autoActivate только для price=0; платные → через payment confirm. В Phase 5 (5.7.2) API передавал autoActivate=true всегда — теперь логика по цене.

## Что должно быть сделано

1. **Обновить subscriptionService.createFromPlan (5.5.2):**

   ```ts
   import { paymentService } from '../payments'

   async createFromPlan(ctx, orgId, planId, opts: { method?: 'cash' | 'transfer' } = {}) {
     const db = getDb(ctx)
     const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, planId) })
     if (!plan || plan.organizationId !== orgId || plan.status !== 'active') throw new PlanNotAvailableError()

     return await db.transaction(async (tx) => {
       const [sub] = await tx.insert(subscriptions).values({
         organizationId: orgId, userId: ctx.userId, planId: plan.id,
         totalSessions: plan.totalSessions, usedSessions: 0, status: 'pending',
       }).returning()

       if (plan.price === 0) {
         // Бесплатный — активируем сразу
         return this.activate({ ...ctx, db: tx }, sub!.id, { validityDays: plan.validityDays })
       }

       // Платный — создаём Payment(pending), subscription остаётся pending
       const payment = await paymentService.createForSubscription({ ...ctx, db: tx }, {
         organizationId: orgId, userId: ctx.userId, subscriptionId: sub!.id,
         amount: plan.price, currency: plan.currency, method: opts.method ?? 'cash',
       })
       return { ...sub!, paymentId: payment.id }
     })
   }
   ```

2. **Обновить API subscription buy (5.7.2)** — убрать autoActivate, передавать method:

   ```ts
   // server/api/organizations/[orgId]/subscriptions/index.post.ts
   const BuyInput = z.object({
     planId: z.number().int().positive(),
     method: z.enum(['cash', 'transfer']).optional(), // для платных
   })

   // в handler:
   const subscription = await subscriptionService.createFromPlan(
     ctx,
     event.context.organization!.id,
     planId,
     { method },
   )
   // autoActivate больше не передаётся — логика внутри по price
   ```

3. **UI plans/buy (5.11.1)** — при платном плане игрок выбирает метод (cash/transfer), confirm-текст «после подтверждения оплаты организатором». Обновить пометку (была «активируется сразу»).

4. **Тесты:**
   ```ts
   test('free plan → subscription active immediately, no Payment', async () => {})
   test('paid plan → subscription pending + Payment pending', async () => {})
   test('paid plan: confirm Payment → subscription active', async () => {}) // через 6.1.3
   test('paid plan default method cash if not specified', async () => {})
   ```

## Критерии приёмки

- ✅ Бесплатный план (price=0) → subscription active сразу, без Payment
- ✅ Платный план → subscription pending + Payment pending
- ✅ Payment amount = plan.price, currency = plan.currency
- ✅ API убрал autoActivate=true, логика по цене внутри сервиса
- ✅ method (cash/transfer) передаётся, дефолт cash
- ✅ После confirm Payment (6.1.3) → subscription active
- ✅ UI обновлён: платный план → выбор метода, честный текст про подтверждение

## Подсказки

- **Логика по цене внутри сервиса** — единое место решения free vs paid. API больше не диктует autoActivate.
- **method дефолт cash** — большинство платят наличными на месте. transfer как опция.
- **UI текст:** для платного «абонемент активируется после подтверждения оплаты» (честно), для бесплатного «получить» сразу.
- **Связь с 6.1.3:** confirm платёжа активирует subscription (subscriptionService.activate). Цепочка замкнута.

## Не делать

- ❌ Не оставлять autoActivate для платных
- ❌ Не активировать платный subscription до confirm
- ❌ Не делать online — Phase 12
