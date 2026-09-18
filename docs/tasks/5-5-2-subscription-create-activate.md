---
id: '5.5.2'
phase: '5'
epic: '5.5'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
depends_on:
  - '5.5.1'
estimated_hours: '1-2'
tags:
  - service
  - subscriptions
---

# Task 5.5.2: SubscriptionService create + activate

## Цель

Методы `createFromPlan` (status=pending) и `activate` (pending→active, set expiresAt). Активация вызывается при оплате (Phase 6) или сразу в dev.

## Контекст

Решение 12: subscription создаётся pending, активируется при оплате. В Phase 5 структура готова, активация при оплате подключится в Phase 6. Для dev/MVP — флаг autoActivate.

## Что должно быть сделано

1. **Модуль `apps/web/modules/subscriptions/`** (service, repository, schemas, errors, index).

2. **`errors.ts`:**

   ```ts
   export class SubscriptionError extends Error {
     code: string
     constructor(code: string, message: string) {
       super(message)
       this.code = code
       this.name = 'SubscriptionError'
     }
   }
   export class SubscriptionNotFoundError extends SubscriptionError {
     constructor(id: number | string) {
       super('subscription.not_found', `Subscription ${id} not found`)
     }
   }
   export class PlanNotAvailableError extends SubscriptionError {
     constructor() {
       super('subscription.plan_not_available', 'Plan is not available')
     }
   }
   export class NoActiveSubscriptionError extends SubscriptionError {
     constructor() {
       super('subscription.no_active', 'No active subscription with remaining sessions')
     }
   }
   export class SubscriptionAlreadyActiveError extends SubscriptionError {
     constructor() {
       super('subscription.already_active', 'Subscription is already active')
     }
   }
   ```

3. **`service.ts` — create + activate:**
   ```ts
   import { getDb, type ServiceContext } from '../shared/context'
   import { subscriptions, subscriptionPlans } from '@volley-time/db'
   import { eq, and } from 'drizzle-orm'
   import { PlanNotAvailableError, SubscriptionNotFoundError } from './errors'

   export const subscriptionService = {
     /**
      * Создать subscription из плана (status=pending).
      * autoActivate=true (dev/MVP) — сразу активирует.
      */
     async createFromPlan(
       ctx: ServiceContext,
       orgId: number,
       planId: number,
       opts: { autoActivate?: boolean } = {},
     ) {
       const db = getDb(ctx)
       const plan = await db.query.subscriptionPlans.findFirst({
         where: eq(subscriptionPlans.id, planId),
       })
       if (!plan || plan.organizationId !== orgId || plan.status !== 'active') {
         throw new PlanNotAvailableError()
       }

       const [sub] = await db
         .insert(subscriptions)
         .values({
           organizationId: orgId,
           userId: ctx.userId,
           planId: plan.id,
           totalSessions: plan.totalSessions, // snapshot
           usedSessions: 0,
           status: 'pending',
         })
         .returning()

       if (opts.autoActivate) {
         return this.activate({ ...ctx, db }, sub!.id, { validityDays: plan.validityDays })
       }
       return sub!
     },

     /**
      * Активировать (pending → active). Устанавливает expiresAt.
      * Вызывается при подтверждении оплаты (Phase 6) или autoActivate.
      */
     async activate(
       ctx: ServiceContext,
       subscriptionId: number,
       opts: { validityDays?: number | null } = {},
     ) {
       const db = getDb(ctx)
       const sub = await db.query.subscriptions.findFirst({
         where: eq(subscriptions.id, subscriptionId),
       })
       if (!sub) throw new SubscriptionNotFoundError(subscriptionId)
       if (sub.status === 'active') return sub // idempotent

       // validityDays: из opts или из плана
       let validityDays = opts.validityDays
       if (validityDays === undefined) {
         const plan = await db.query.subscriptionPlans.findFirst({
           where: eq(subscriptionPlans.id, sub.planId),
         })
         validityDays = plan?.validityDays ?? null
       }
       const expiresAt = validityDays
         ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
         : null

       const [activated] = await db
         .update(subscriptions)
         .set({
           status: 'active',
           activatedAt: new Date(),
           expiresAt,
           updatedAt: new Date(),
         })
         .where(eq(subscriptions.id, subscriptionId))
         .returning()
       return activated!
     },

     async getById(ctx: ServiceContext, id: number) {
       const s = await getDb(ctx).query.subscriptions.findFirst({ where: eq(subscriptions.id, id) })
       if (!s) throw new SubscriptionNotFoundError(id)
       return s
     },

     async listActiveForUser(ctx: ServiceContext, orgId: number) {
       const db = getDb(ctx)
       return db.query.subscriptions.findMany({
         where: and(
           eq(subscriptions.userId, ctx.userId),
           eq(subscriptions.organizationId, orgId),
           eq(subscriptions.status, 'active'),
         ),
         with: { plan: true },
         orderBy: (s, { asc }) => [asc(s.expiresAt)],
       })
     },
   }
   ```

## Критерии приёмки

- ✅ createFromPlan создаёт subscription status=pending, totalSessions snapshot из plana
- ✅ Plan чужой org / archived → PlanNotAvailableError
- ✅ autoActivate=true → сразу active с expiresAt
- ✅ activate: pending → active, set expiresAt из validityDays
- ✅ validityDays=null → expiresAt=null (бессрочно)
- ✅ activate идемпотентен (повторно → тот же active)
- ✅ listActiveForUser → active subs, сортировка по expiresAt ASC

## Подсказки

- **autoActivate в Phase 5:** API endpoint (5.7.2) передаёт autoActivate=true для MVP (нет реальной оплаты). В Phase 6 — autoActivate=false, активация в payment confirm.
- **expiresAt от момента активации:** validity «60 дней» отсчитывается с активации (оплаты), не с создания. Логично — оплатил, пошёл отсчёт.
- **totalSessions snapshot** — копия из plan, не live-ссылка.

## Не делать

- ❌ Не делать payment здесь — Phase 6 вызовет activate
- ❌ Не делать consume — это 5.5.3
- ❌ Не делать refund — Phase 6
