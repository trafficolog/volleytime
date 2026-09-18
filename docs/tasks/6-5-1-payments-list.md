---
id: '6.5.1'
phase: '6'
epic: '6.5'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - FE
depends_on:
  - '6.1.3'
  - '6.2.3'
estimated_hours: '1-2'
tags:
  - ui
  - payments
  - admin
---

# Task 6.5.1: usePayments composable + список pending

## Цель

Composable `usePayments` + страница `/m/orgs/:orgId/payments` со списком ожидающих подтверждения платежей (игрок, за что, сумма, метод).

## Контекст

Организатор принял наличные/перевод, подтверждает в приложении. Переиспускает паттерны Phase 5 UI (composables, labels, формат цены).

## Что должно быть сделано

1. **API payments list endpoint** (`server/api/organizations/[orgId]/payments/index.get.ts`):

   ```ts
   import { paymentService } from '~/modules/payments'
   import { requireCanManageContent } from '~/modules/permissions'
   import { createServiceContextFromEvent } from '~/modules/shared/context'

   export default defineEventHandler(async (event) => {
     requireCanManageContent(event.context.member)
     const ctx = createServiceContextFromEvent(event)
     const payments = await paymentService.listPending(ctx, event.context.organization!.id)
     return { payments }
   })
   ```

2. **Composable `apps/web/composables/usePayments.ts`:**

   ```ts
   export function usePayments(orgId: Ref<number> | number) {
     const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
     const payments = ref<any[]>([])
     const loading = ref(false)

     async function fetchPending() {
       loading.value = true
       try {
         const data = await $fetch<{ payments: any[] }>(
           `/api/organizations/${orgIdRef.value}/payments`,
         )
         payments.value = data.payments
       } finally {
         loading.value = false
       }
     }
     async function confirm(paymentId: number) {
       await $fetch(`/api/organizations/${orgIdRef.value}/payments/${paymentId}/confirm`, {
         method: 'POST',
       })
       await fetchPending()
     }
     async function reject(paymentId: number) {
       await $fetch(`/api/organizations/${orgIdRef.value}/payments/${paymentId}/cancel`, {
         method: 'POST',
       })
       await fetchPending()
     }
     return { payments, loading, fetchPending, confirm, reject }
   }
   ```

3. **Страница `pages/m/orgs/[orgId]/payments/index.vue`:**
   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <NuxtLink :to="`/m/orgs/${orgId}`" class="text-blue-500">←</NuxtLink>
           <h1 class="text-lg font-semibold">Ожидают оплаты</h1>
         </header>

         <main class="px-4 py-4">
           <div v-if="loading" class="py-12 flex justify-center">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
           </div>
           <div v-else-if="payments.length === 0" class="text-center py-12 text-gray-500">
             Нет платежей, ожидающих подтверждения
           </div>
           <ul v-else class="space-y-3">
             <li v-for="p in payments" :key="p.id" class="bg-white border rounded-lg p-4">
               <div class="flex items-start justify-between gap-2 mb-2">
                 <div>
                   <div class="font-medium">{{ p.user.name || `User ${p.userId}` }}</div>
                   <div class="text-sm text-gray-600">{{ paymentTargetLabel(p) }}</div>
                   <div class="text-xs text-gray-400 mt-0.5">{{ methodLabel(p.method) }}</div>
                 </div>
                 <div class="text-lg font-semibold text-blue-600 shrink-0">
                   {{ formatPrice(p.amount, p.currency) }}
                 </div>
               </div>
               <div class="flex gap-2 mt-3">
                 <button
                   type="button"
                   class="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                   :disabled="busy === p.id"
                   @click="onConfirm(p)"
                 >
                   Подтвердить
                 </button>
                 <button
                   type="button"
                   class="flex-1 border border-red-300 text-red-600 py-2 rounded-lg text-sm disabled:opacity-50"
                   :disabled="busy === p.id"
                   @click="onReject(p)"
                 >
                   Отклонить
                 </button>
               </div>
             </li>
           </ul>
         </main>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const route = useRoute()
   const orgId = computed(() => Number(route.params.orgId))
   const { payments, loading, fetchPending, confirm, reject } = usePayments(orgId)
   const { formatPrice } = useFormatters()

   const busy = ref<number | null>(null)

   await fetchPending()

   async function onConfirm(p: any) {
     busy.value = p.id
     try {
       await confirm(p.id)
     } finally {
       busy.value = null
     }
   }
   async function onReject(p: any) {
     if (!confirm_('Отклонить платёж? Запись игрока будет отменена.')) return
     busy.value = p.id
     try {
       await reject(p.id)
     } finally {
       busy.value = null
     }
   }
   const confirm_ = (msg: string) => window.confirm(msg)

   function paymentTargetLabel(p: any): string {
     if (p.booking?.event) return `Событие: ${p.booking.event.title}`
     if (p.subscription?.plan) return `Абонемент: ${p.subscription.plan.name}`
     return 'Оплата'
   }
   function methodLabel(m: string): string {
     return { cash: 'Наличные', transfer: 'Перевод', online: 'Онлайн' }[m] ?? m
   }
   </script>
   ```

## Критерии приёмки

- ✅ API listPending endpoint (owner/organizer)
- ✅ usePayments: fetchPending, confirm, reject
- ✅ Список: игрок, за что (событие/абонемент), метод, сумма
- ✅ Кнопки «Подтвердить» (green) / «Отклонить» (red)
- ✅ Reject с confirm-диалогом (предупреждение об отмене записи)
- ✅ После действия — список обновляется
- ✅ Empty state, loading
- ✅ Метод на русском (Наличные/Перевод)
- ✅ Только owner/organizer

## Подсказки

- **paymentTargetLabel** — polymorphic: показывает событие или абонемент в зависимости от того, что заполнено.
- **formatPrice** из useFormatters (5.9.1) — конверсия minor→major.
- **busy per-id** — блокирует кнопки конкретного платежа во время операции.

## Не делать

- ❌ Не показывать succeeded/cancelled (только pending) — история в кассе (6.6)
- ❌ Не делать bulk confirm
- ❌ Не делать online — Phase 12
