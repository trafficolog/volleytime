---
id: '5.10.2'
phase: '5'
epic: '5.10'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - FE
depends_on:
  - '5.4.2'
estimated_hours: '1-2'
tags:
  - ui
  - subscription-plans
  - admin
---

# Task 5.10.2: Управление subscription plans (admin)

## Цель

Страница `/m/orgs/:orgId/plans` (admin view) — список планов абонементов, создание/редактирование/архивирование.

## Контекст

Организатор создаёт планы («8 занятий за 80 BYN, 60 дней»). Решение 8: планы per-org, могут быть бесплатными. Этот же composable (useSubscriptionPlans) переиспользуется в 5.11 (player view покупки).

## Что должно быть сделано

1. **Composable `apps/web/composables/useSubscriptionPlans.ts`:**

   ```ts
   export function useSubscriptionPlans(orgId: Ref<number> | number) {
     const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
     const plans = ref<any[]>([])
     const loading = ref(false)

     async function fetchAll() {
       loading.value = true
       try {
         const data = await $fetch<{ plans: any[] }>(
           `/api/organizations/${orgIdRef.value}/subscription-plans`,
         )
         plans.value = data.plans
       } finally {
         loading.value = false
       }
     }
     async function create(input: any) {
       const data = await $fetch<{ plan: any }>(
         `/api/organizations/${orgIdRef.value}/subscription-plans`,
         { method: 'POST', body: input },
       )
       await fetchAll()
       return data.plan
     }
     async function update(id: number, input: any) {
       await $fetch(`/api/organizations/${orgIdRef.value}/subscription-plans/${id}`, {
         method: 'PATCH',
         body: input,
       })
       await fetchAll()
     }
     async function archive(id: number) {
       await $fetch(`/api/organizations/${orgIdRef.value}/subscription-plans/${id}`, {
         method: 'DELETE',
       })
       await fetchAll()
     }
     return { plans, loading, fetchAll, create, update, archive }
   }
   ```

2. **Страница `pages/m/orgs/[orgId]/plans/index.vue`:**
   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header
           class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center justify-between"
         >
           <div class="flex items-center gap-3">
             <NuxtLink :to="`/m/orgs/${orgId}`" class="text-blue-500">←</NuxtLink>
             <h1 class="text-lg font-semibold">Абонементы</h1>
           </div>
           <button
             type="button"
             class="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm"
             @click="openCreate"
           >
             + План
           </button>
         </header>

         <main class="px-4 py-4">
           <div v-if="loading" class="py-12 flex justify-center">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
           </div>
           <div v-else-if="plans.length === 0" class="text-center py-12 text-gray-500">
             Нет планов. Создайте первый, чтобы игроки могли покупать абонементы.
           </div>
           <ul v-else class="space-y-3">
             <li v-for="p in plans" :key="p.id" class="bg-white border rounded-lg p-4">
               <div class="flex items-start justify-between gap-2">
                 <div>
                   <div class="font-medium">{{ p.name }}</div>
                   <div class="text-sm text-gray-600 mt-1">
                     {{ p.totalSessions }}
                     {{ plural(p.totalSessions, ['занятие', 'занятия', 'занятий']) }} ·
                     {{ formatPrice(p.price, p.currency) }}
                     <span v-if="p.validityDays"> · {{ p.validityDays }} дней</span>
                     <span v-else> · бессрочно</span>
                   </div>
                   <div v-if="p.description" class="text-xs text-gray-500 mt-1">
                     {{ p.description }}
                   </div>
                 </div>
                 <div class="flex flex-col gap-1 shrink-0">
                   <button
                     type="button"
                     class="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                     @click="openEdit(p)"
                   >
                     Изменить
                   </button>
                   <button
                     type="button"
                     class="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                     @click="onArchive(p)"
                   >
                     Архив
                   </button>
                 </div>
               </div>
             </li>
           </ul>
         </main>

         <!-- Create/Edit sheet -->
         <div
           v-if="showSheet"
           class="fixed inset-0 bg-black/50 z-30 flex items-end justify-center"
           @click="showSheet = false"
         >
           <div class="bg-white rounded-t-2xl w-full max-w-md p-6" @click.stop>
             <h2 class="text-lg font-semibold mb-4">
               {{ editingId ? 'Изменить план' : 'Новый план' }}
             </h2>
             <form @submit.prevent="onSave" class="space-y-3">
               <input
                 v-model="form.name"
                 type="text"
                 required
                 placeholder="Название (8 занятий)"
                 class="w-full border rounded-lg px-3 py-2"
               />
               <div class="grid grid-cols-2 gap-3">
                 <div>
                   <label class="block text-xs text-gray-500 mb-1">Занятий</label>
                   <input
                     v-model.number="form.totalSessions"
                     type="number"
                     required
                     min="1"
                     class="w-full border rounded-lg px-3 py-2"
                   />
                 </div>
                 <div>
                   <label class="block text-xs text-gray-500 mb-1"
                     >Цена ({{ form.currency }})</label
                   >
                   <input
                     v-model.number="priceMajor"
                     type="number"
                     min="0"
                     step="0.01"
                     class="w-full border rounded-lg px-3 py-2"
                   />
                 </div>
               </div>
               <div>
                 <label class="block text-xs text-gray-500 mb-1"
                   >Срок действия (дней, пусто = бессрочно)</label
                 >
                 <input
                   v-model.number="form.validityDays"
                   type="number"
                   min="1"
                   class="w-full border rounded-lg px-3 py-2"
                   placeholder="60"
                 />
               </div>
               <textarea
                 v-model="form.description"
                 rows="2"
                 placeholder="Описание (необязательно)"
                 class="w-full border rounded-lg px-3 py-2"
               ></textarea>
               <div class="flex gap-2">
                 <button
                   type="button"
                   class="flex-1 border py-2 rounded-lg"
                   @click="showSheet = false"
                 >
                   Отмена
                 </button>
                 <button
                   type="submit"
                   class="flex-1 bg-blue-500 text-white py-2 rounded-lg"
                   :disabled="saving"
                 >
                   Сохранить
                 </button>
               </div>
             </form>
           </div>
         </div>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })
   import { plural } from '~/utils/labels'

   const route = useRoute()
   const orgId = computed(() => Number(route.params.orgId))
   const { plans, loading, fetchAll, create, update, archive } = useSubscriptionPlans(orgId)
   const { formatPrice } = useFormatters()

   const showSheet = ref(false)
   const saving = ref(false)
   const editingId = ref<number | null>(null)
   const priceMajor = ref(0)
   const form = ref({
     name: '',
     totalSessions: 8,
     currency: 'BYN',
     validityDays: null as number | null,
     description: '',
   })

   await fetchAll()

   function openCreate() {
     editingId.value = null
     form.value = {
       name: '',
       totalSessions: 8,
       currency: 'BYN',
       validityDays: null,
       description: '',
     }
     priceMajor.value = 0
     showSheet.value = true
   }
   function openEdit(p: any) {
     editingId.value = p.id
     form.value = {
       name: p.name,
       totalSessions: p.totalSessions,
       currency: p.currency,
       validityDays: p.validityDays,
       description: p.description ?? '',
     }
     priceMajor.value = p.price / 100
     showSheet.value = true
   }
   async function onSave() {
     saving.value = true
     try {
       const payload = {
         ...form.value,
         price: Math.round(priceMajor.value * 100),
         validityDays: form.value.validityDays || null,
       }
       if (editingId.value) await update(editingId.value, payload)
       else await create(payload)
       showSheet.value = false
     } finally {
       saving.value = false
     }
   }
   async function onArchive(p: any) {
     if (!confirm(`Архивировать план «${p.name}»? Существующие абонементы продолжат работать.`))
       return
     await archive(p.id)
   }
   </script>
   ```

## Критерии приёмки

- ✅ Список планов: название, занятия (плюрализация), цена, срок/бессрочно, описание
- ✅ Создание через sheet: name, totalSessions, price (major→minor), validityDays (опц), description
- ✅ Редактирование загружает значения
- ✅ Бесплатный план (price=0) создаётся и показывается «Бесплатно»
- ✅ validityDays пусто → «бессрочно»
- ✅ Архивирование с confirm (предупреждение про существующие абонементы)
- ✅ Только owner/organizer
- ✅ useSubscriptionPlans переиспользуем в 5.11

## Подсказки

- **plural и formatPrice** из shared utils (5.9.5, 5.9.1).
- **validityDays || null:** пустая строка/0 → null (бессрочно).
- **Архив не ломает абонементы:** backend (5.4) гарантирует — existing subscriptions работают. UI предупреждает.

## Не делать

- ❌ Не делать аналитику продаж планов — Phase 14
- ❌ Не делать промо/скидки — Phase 14+
- ❌ Не показывать сколько куплено (это отдельная аналитика)
