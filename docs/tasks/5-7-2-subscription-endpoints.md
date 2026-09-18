---
id: '5.7.2'
phase: '5'
epic: '5.7'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '5.5.2'
  - '5.5.4'
  - '4.5.1'
estimated_hours: '1'
tags:
  - api
  - subscriptions
  - nuxt
---

# Task 5.7.2: Subscription endpoints (buy, my)

## Цель

Endpoints: получить абонемент (createFromPlan, autoActivate в Phase 5), мои абонементы с остатком.

## Контекст

В Phase 5 «покупка» = createFromPlan с autoActivate=true (нет реальной оплаты — Phase 6). Структура готова к переключению на pending+activate-on-payment.

## Что должно быть сделано

1. **`subscriptions/index.post.ts`** — получить абонемент:

   ```ts
   import { z } from 'zod'
   import { subscriptionService } from '~/modules/subscriptions'
   import { requireOrgMember } from '~/modules/permissions'
   import { createServiceContextFromEvent } from '~/modules/shared/context'
   import { handleServiceError } from '~/server/utils/handle-errors'

   const BuyInput = z.object({ planId: z.number().int().positive() })

   export default defineEventHandler(async (event) => {
     try {
       requireOrgMember(event.context.member)
       const ctx = createServiceContextFromEvent(event)
       const { planId } = BuyInput.parse(await readBody(event))

       // Phase 5: autoActivate=true (оплата подключится в Phase 6 → autoActivate=false)
       const subscription = await subscriptionService.createFromPlan(
         ctx,
         event.context.organization!.id,
         planId,
         { autoActivate: true },
       )
       return { subscription }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

2. **`my/subscriptions/index.get.ts`** — мои абонементы:

   ```ts
   export default defineEventHandler(async (event) => {
     requireOrgMember(event.context.member)
     const ctx = createServiceContextFromEvent(event)
     const subscriptions = await subscriptionService.listForUserWithRemaining(
       ctx,
       event.context.organization!.id,
     )
     return { subscriptions }
   })
   ```

3. **handle-errors** — SubscriptionError codes:
   ```ts
   const codeToStatus = {
     ...existing,
     'subscription.not_found': 404,
     'subscription.plan_not_available': 422,
     'subscription.no_active': 422,
     'booking.no_active_subscription': 422,
   }
   if (e instanceof SubscriptionError) {
     /* map */
   }
   ```

## Критерии приёмки

- ✅ POST subscriptions — active member, body { planId }, создаёт active subscription (autoActivate)
- ✅ Plan чужой org/archived → 422 plan_not_available
- ✅ GET my/subscriptions — список с remainingSessions
- ✅ Ошибки маппятся
- ✅ Cross-org защита (planId проверяется в service)

## Подсказки

- **autoActivate=true только Phase 5.** Комментарий в коде: «// Phase 6: убрать autoActivate, активация в payment confirm». Чёткая точка изменения.
- **remainingSessions** = totalSessions - usedSessions (в listForUserWithRemaining, 5.5.4).
- **Покупка одного плана несколько раз:** разрешено — игрок может иметь 2 абонемента одного плана. FIFO разрулит порядок списания.

## Не делать

- ❌ Не делать payment — Phase 6
- ❌ Не делать отмену/возврат абонемента — Phase 6
- ❌ Не делать лимит «один абонемент на план»
