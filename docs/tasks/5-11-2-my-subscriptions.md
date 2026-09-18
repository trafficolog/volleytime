---
id: '5.11.2'
phase: '5'
epic: '5.11'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - FE
depends_on:
  - '5.11.1'
estimated_hours: '1-2'
tags:
  - ui
  - subscriptions
  - mini-app
---

# Task 5.11.2: Мои абонементы (остаток, срок, статус)

## Цель

Страница `/m/orgs/:orgId/my/subscriptions` — абонементы игрока: остаток сессий (прогресс), срок, статус.

## Контекст

Игрок видит свои абонементы. Главное — остаток сессий и срок действия. Используется useSubscriptions (5.11.1).

## Что должно быть сделано

1. **Страница `pages/m/orgs/[orgId]/my/subscriptions/index.vue`:**

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <NuxtLink :to="`/m/orgs/${orgId}`" class="text-blue-500">←</NuxtLink>
           <h1 class="text-lg font-semibold">Мои абонементы</h1>
         </header>

         <main class="px-4 py-4">
           <div v-if="loading" class="py-12 flex justify-center">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
           </div>
           <div v-else-if="subscriptions.length === 0" class="text-center py-12">
             <p class="text-gray-500 mb-4">У вас нет активных абонементов</p>
             <NuxtLink
               :to="`/m/orgs/${orgId}/plans/buy`"
               class="inline-block bg-blue-500 text-white px-6 py-2.5 rounded-lg"
             >
               Посмотреть абонементы
             </NuxtLink>
           </div>

           <ul v-else class="space-y-3">
             <li v-for="s in subscriptions" :key="s.id" class="bg-white border rounded-lg p-4">
               <div class="flex items-start justify-between gap-2 mb-2">
                 <div class="font-medium">{{ s.plan?.name ?? 'Абонемент' }}</div>
                 <span class="text-xs px-2 py-0.5 rounded-full" :class="statusBadge(s.status)">
                   {{ subscriptionStatus(s.status) }}
                 </span>
               </div>

               <div class="mb-2">
                 <div class="flex justify-between text-sm mb-1">
                   <span class="text-gray-600">Осталось занятий</span>
                   <span class="font-medium"
                     >{{ s.remainingSessions }} из {{ s.totalSessions }}</span
                   >
                 </div>
                 <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                   <div
                     class="h-full bg-blue-500 rounded-full"
                     :style="{ width: `${remainingPercent(s)}%` }"
                   />
                 </div>
               </div>

               <div v-if="s.expiresAt" class="text-sm text-gray-500">
                 Действует до {{ formatDate(s.expiresAt) }}
                 <span v-if="isExpiringSoon(s)" class="text-orange-600">· скоро истекает</span>
               </div>
               <div v-else class="text-sm text-gray-500">Без срока действия</div>
             </li>
           </ul>
         </main>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })
   import { SUBSCRIPTION_STATUS_LABELS, label } from '~/utils/labels'

   const route = useRoute()
   const orgId = computed(() => Number(route.params.orgId))
   const { subscriptions, loading, fetchMy } = useSubscriptions(orgId)
   const { formatDate } = useFormatters()

   await fetchMy()

   function remainingPercent(s: any) {
     return Math.round((s.remainingSessions / s.totalSessions) * 100)
   }
   function isExpiringSoon(s: any) {
     if (!s.expiresAt) return false
     const days = (new Date(s.expiresAt).getTime() - Date.now()) / 86400000
     return days <= 7 && days > 0
   }
   function subscriptionStatus(s: string) {
     return label(SUBSCRIPTION_STATUS_LABELS, s)
   }
   function statusBadge(s: string) {
     return (
       {
         active: 'bg-green-100 text-green-700',
         pending: 'bg-yellow-100 text-yellow-700',
         exhausted: 'bg-gray-100 text-gray-600',
         expired: 'bg-red-100 text-red-700',
         cancelled: 'bg-gray-100 text-gray-500',
       }[s] ?? 'bg-gray-100 text-gray-600'
     )
   }
   </script>
   ```

2. **Плитка в dashboard** (`/m/orgs/[orgId]/index.vue`) — «Абонементы» ведёт на plans/buy, и «Мои записи» уже есть (5.9.4). Можно добавить «Мои абонементы».

3. **my/subscriptions по умолчанию показывает active** (из listForUserWithRemaining, 5.5.4 — только active). Если нужны все статусы — расширить endpoint, но в Phase 5 active достаточно.

## Критерии приёмки

- ✅ Список абонементов: название плана, статус (badge), остаток с прогресс-баром
- ✅ Остаток: «5 из 8» + прогресс-бар
- ✅ Срок действия или «без срока»
- ✅ «Скоро истекает» (≤7 дней) — orange пометка
- ✅ Empty state с кнопкой к планам
- ✅ Статусы переведены (active=Активен, etc.)
- ✅ Использует useSubscriptions + shared utils

## Подсказки

- **remainingSessions приходит с backend** (listForUserWithRemaining, 5.5.4). Не вычисляем на клиенте.
- **isExpiringSoon ≤7 дней** — подсказка игроку использовать абонемент. В Phase 15 — push-напоминание.
- **active-only в Phase 5:** endpoint возвращает active. Exhausted/expired не показываем (можно добавить вкладку «история» в Phase 14).

## Не делать

- ❌ Не показывать историю списаний (какое занятие когда) — Phase 14
- ❌ Не делать продление/докупку из этого экрана
- ❌ Не делать заморозку — Phase 14+
