---
id: '5.11.1'
phase: '5'
epic: '5.11'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - FE
depends_on:
  - '5.7.2'
  - '5.10.2'
estimated_hours: '1-2'
tags:
  - ui
  - subscriptions
  - mini-app
---

# Task 5.11.1: Список планов (player) + получение абонемента

## Цель

Player-view планов: доступные абонементы с кнопкой «Получить». В Phase 5 получение = createFromPlan autoActivate (без оплаты).

## Контекст

Игрок выбирает план и получает абонемент. Решение 12: в Phase 5 autoActivate (структура готова к оплате в Phase 6). Переиспользует useSubscriptionPlans (5.10.2) для списка + useSubscriptions для покупки.

## Что должно быть сделано

1. **Composable `apps/web/composables/useSubscriptions.ts`:**

   ```ts
   export function useSubscriptions(orgId: Ref<number> | number) {
     const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
     const subscriptions = ref<any[]>([])
     const loading = ref(false)

     async function fetchMy() {
       loading.value = true
       try {
         const data = await $fetch<{ subscriptions: any[] }>(
           `/api/organizations/${orgIdRef.value}/my/subscriptions`,
         )
         subscriptions.value = data.subscriptions
       } finally {
         loading.value = false
       }
     }
     async function acquire(planId: number) {
       const data = await $fetch<{ subscription: any }>(
         `/api/organizations/${orgIdRef.value}/subscriptions`,
         {
           method: 'POST',
           body: { planId },
         },
       )
       await fetchMy()
       return data.subscription
     }
     return { subscriptions, loading, fetchMy, acquire }
   }
   ```

2. **Player-view планов** — отдельная страница или вкладка. Сделаем `pages/m/orgs/[orgId]/plans/buy.vue` (или роут с режимом). Здесь — доступные планы:
   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <NuxtLink :to="`/m/orgs/${orgId}`" class="text-blue-500">←</NuxtLink>
           <h1 class="text-lg font-semibold">Абонементы</h1>
         </header>

         <main class="px-4 py-4">
           <NuxtLink
             :to="`/m/orgs/${orgId}/my/subscriptions`"
             class="block mb-4 text-center text-sm text-blue-600 border border-blue-200 rounded-lg py-2"
           >
             Мои абонементы →
           </NuxtLink>

           <div v-if="loading" class="py-12 flex justify-center">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
           </div>
           <div v-else-if="plans.length === 0" class="text-center py-12 text-gray-500">
             Организатор пока не создал абонементы
           </div>
           <ul v-else class="space-y-3">
             <li v-for="p in plans" :key="p.id" class="bg-white border rounded-lg p-4">
               <div class="flex items-start justify-between gap-2 mb-2">
                 <div class="font-medium text-lg">{{ p.name }}</div>
                 <div class="text-lg font-semibold text-blue-600">
                   {{ formatPrice(p.price, p.currency) }}
                 </div>
               </div>
               <div class="text-sm text-gray-600 mb-1">
                 {{ p.totalSessions }}
                 {{ plural(p.totalSessions, ['занятие', 'занятия', 'занятий']) }}
                 <span v-if="p.validityDays"> · действует {{ p.validityDays }} дней</span>
                 <span v-else> · без срока</span>
               </div>
               <div v-if="p.description" class="text-sm text-gray-500 mb-3">
                 {{ p.description }}
               </div>
               <button
                 type="button"
                 class="w-full bg-blue-500 text-white py-2.5 rounded-lg font-medium disabled:opacity-50"
                 :disabled="acquiring === p.id"
                 @click="onAcquire(p)"
               >
                 {{
                   acquiring === p.id
                     ? 'Оформление…'
                     : p.price === 0
                       ? 'Получить'
                       : 'Получить абонемент'
                 }}
               </button>
             </li>
           </ul>
         </main>

         <!-- Success sheet -->
         <div
           v-if="acquired"
           class="fixed inset-0 bg-black/50 z-30 flex items-end justify-center"
           @click="acquired = null"
         >
           <div class="bg-white rounded-t-2xl w-full max-w-md p-6 text-center" @click.stop>
             <div class="text-4xl mb-3">✓</div>
             <h2 class="text-lg font-semibold mb-1">Абонемент оформлен</h2>
             <p class="text-sm text-gray-600 mb-4">
               {{ acquired.totalSessions }}
               {{ plural(acquired.totalSessions, ['занятие', 'занятия', 'занятий']) }} доступно.
               Теперь можно записываться на события с абонемента.
             </p>
             <div class="flex gap-2">
               <NuxtLink
                 :to="`/m/orgs/${orgId}/my/subscriptions`"
                 class="flex-1 border py-2 rounded-lg"
                 >Мои абонементы</NuxtLink
               >
               <NuxtLink
                 :to="`/m/orgs/${orgId}/events`"
                 class="flex-1 bg-blue-500 text-white py-2 rounded-lg"
                 >К событиям</NuxtLink
               >
             </div>
           </div>
         </div>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })
   import { plural, errorMessage } from '~/utils/labels'

   const route = useRoute()
   const orgId = computed(() => Number(route.params.orgId))
   const { plans, loading, fetchAll } = useSubscriptionPlans(orgId)
   const { acquire } = useSubscriptions(orgId)
   const { formatPrice } = useFormatters()

   const acquiring = ref<number | null>(null)
   const acquired = ref<any>(null)

   await fetchAll()

   async function onAcquire(plan: any) {
     const msg =
       plan.price === 0
         ? `Получить абонемент «${plan.name}»?`
         : `Оформить абонемент «${plan.name}» за ${formatPrice(plan.price, plan.currency)}?\n\nОплата подтверждается организатором (в этой версии абонемент активируется сразу).`
     if (!confirm(msg)) return
     acquiring.value = plan.id
     try {
       acquired.value = await acquire(plan.id)
     } catch (e: any) {
       alert(errorMessage(e?.data?.code, 'Не удалось оформить абонемент'))
     } finally {
       acquiring.value = null
     }
   }
   </script>
   ```

## Критерии приёмки

- ✅ Список доступных планов с ценой, занятиями, сроком, описанием
- ✅ Кнопка «Получить» → confirm → createFromPlan (autoActivate)
- ✅ Бесплатный план → «Получить» без упоминания оплаты
- ✅ Платный → confirm с пояснением (в Phase 5 активируется сразу)
- ✅ Success sheet с переходами (мои абонементы / к событиям)
- ✅ Ссылка на «Мои абонементы»
- ✅ Ошибки переведены
- ✅ Empty state если планов нет

## Подсказки

- **autoActivate прозрачен игроку:** в Phase 5 абонемент активен сразу. Confirm-сообщение для платных честно поясняет «активируется сразу» (в Phase 6 будет «после подтверждения оплаты»).
- **Переиспользуем useSubscriptionPlans** (5.10.2) для списка — тот же endpoint, player видит активные планы.
- **plural/formatPrice/errorMessage** из shared utils.

## Не делать

- ❌ Не делать оплату — Phase 6
- ❌ Не делать корзину/несколько сразу
- ❌ Не блокировать покупку при наличии активного (можно несколько абонементов)
