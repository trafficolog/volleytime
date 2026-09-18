---
id: '6.5.2'
phase: '6'
epic: '6.5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 6.8.'
roles:
  - FE
  - BACK
depends_on:
  - '6.5.1'
estimated_hours: '1-2'
tags:
  - ui
  - payments
  - admin
---

# Task 6.5.2: Confirm/reject endpoints + интеграция в dashboard

## Цель

API endpoints confirm/cancel платежей. Плитка «Ожидают оплаты» в dashboard с счётчиком. Интеграция со списком записей события (5.10.3 pending payment пометка → теперь подтверждаемо).

## Контекст

Завершает payment UI. Endpoints для confirm/reject (вызывают paymentService 6.1.3/6.1.4). Dashboard показывает количество pending — организатор видит, что есть что подтвердить.

## Что должно быть сделано

1. **API endpoints:**

   ```ts
   // server/api/organizations/[orgId]/payments/[paymentId]/confirm.post.ts
   import { paymentService } from '~/modules/payments'
   import { requireCanManageContent } from '~/modules/permissions'
   import { createServiceContextFromEvent } from '~/modules/shared/context'
   import { handleServiceError } from '~/server/utils/handle-errors'

   export default defineEventHandler(async (event) => {
     try {
       requireCanManageContent(event.context.member)
       const ctx = createServiceContextFromEvent(event)
       const paymentId = Number(getRouterParam(event, 'paymentId'))
       // verify payment org ownership
       const p = await paymentService.getById(ctx, paymentId)
       if (p.organizationId !== event.context.organization!.id) {
         throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
       }
       const confirmed = await paymentService.confirm(ctx, paymentId)
       return { payment: confirmed }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

   Аналогично `cancel.post.ts` → paymentService.cancel.

2. **Dashboard плитка** (`/m/orgs/[orgId]/index.vue`) — добавить с счётчиком pending:

   ```vue
   <NuxtLink
     v-if="canManage"
     :to="`/m/orgs/${org.id}/payments`"
     class="bg-white border rounded-lg p-4 hover:border-blue-300 relative"
   >
     <div class="text-2xl mb-1">💳</div>
     <div class="font-medium">Оплаты</div>
     <span v-if="pendingPaymentsCount > 0"
       class="absolute top-2 right-2 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
       {{ pendingPaymentsCount }}
     </span>
   </NuxtLink>
   ```

   Загрузка счётчика:

   ```ts
   const pendingPaymentsCount = ref(0)
   if (canManage.value) {
     const data = await $fetch<{ payments: any[] }>(`/api/organizations/${orgId}/payments`)
     pendingPaymentsCount.value = data.payments.length
   }
   ```

3. **Обновить 5.10.3 (event bookings)** — pending payment секция: добавить кнопку «Подтвердить оплату» (раньше была пометка «в следующем обновлении»). Теперь ведёт на confirm или прямо подтверждает:

   ```vue
   <!-- в pendingPayment секции 5.10.3 -->
   <button
     v-if="b.paymentId"
     type="button"
     class="mt-2 text-xs bg-green-500 text-white px-3 py-1 rounded"
     @click="confirmPayment(b.paymentId)"
   >
     Подтвердить оплату
   </button>
   ```

4. **handle-errors** — PaymentError codes (если не добавлены в 6.2.3):
   ```ts
   'payment.not_found': 404, 'payment.not_pending': 409, 'payment.not_succeeded': 409,
   ```

## Критерии приёмки

- ✅ POST confirm → paymentService.confirm (booking confirmed / subscription active + ledger)
- ✅ POST cancel → paymentService.cancel (booking cancelled)
- ✅ Cross-org: payment чужой org → 404
- ✅ Только owner/organizer
- ✅ Dashboard плитка «Оплаты» с badge счётчиком pending
- ✅ Event bookings (5.10.3): pending payment → кнопка «Подтвердить оплату» работает
- ✅ Ошибки переведены (not_pending → уже обработан)

## Подсказки

- **Badge счётчик** — организатор сразу видит, есть ли что подтвердить. Orange как accent.
- **Интеграция с 5.10.3** — раньше pending payment был «только просмотр», теперь подтверждаемо прямо со страницы события или из списка оплат.
- **Cross-org проверка** обязательна (paymentId в URL).

## Не делать

- ❌ Не делать bulk
- ❌ Не делать online — Phase 12
- ❌ Не делать уведомления — Phase 8
