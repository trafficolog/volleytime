---
id: '5.9.4'
phase: '5'
epic: '5.9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - FE
depends_on:
  - '5.9.3'
estimated_hours: '1-2'
tags:
  - ui
  - bookings
  - mini-app
---

# Task 5.9.4: Мои записи + отмена

## Цель

Страница `/m/orgs/:orgId/my/bookings` — список записей игрока (upcoming/past табы), статусы на русском, отмена для предстоящих.

## Контекст

Игрок видит свои записи. Для предстоящих — кнопка отмены (с учётом deadline). Прошедшие — показывают attended/no_show.

## Что должно быть сделано

1. **Страница `apps/web/pages/m/orgs/[orgId]/my/bookings/index.vue`:**

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <NuxtLink :to="`/m/orgs/${orgId}`" class="text-blue-500">←</NuxtLink>
           <h1 class="text-lg font-semibold">Мои записи</h1>
         </header>

         <main class="px-4 py-4">
           <div class="flex gap-2 mb-4">
             <button
               v-for="tab in tabs"
               :key="tab.value"
               type="button"
               class="px-3 py-1 text-sm rounded-full border"
               :class="
                 filter === tab.value
                   ? 'bg-blue-500 text-white border-blue-500'
                   : 'bg-white text-gray-700 border-gray-200'
               "
               @click="setFilter(tab.value)"
             >
               {{ tab.label }}
             </button>
           </div>

           <div v-if="loading" class="py-12 flex justify-center">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
           </div>
           <div v-else-if="bookings.length === 0" class="text-center py-12 text-gray-500">
             {{ filter === 'upcoming' ? 'Нет предстоящих записей' : 'Нет записей' }}
           </div>

           <ul v-else class="space-y-3">
             <li v-for="b in bookings" :key="b.id" class="bg-white border rounded-lg p-4">
               <NuxtLink :to="`/m/orgs/${orgId}/events/${b.eventId}`" class="block">
                 <div class="flex items-start justify-between gap-2 mb-1">
                   <div class="font-medium">{{ b.event.title }}</div>
                   <span
                     class="text-xs px-2 py-0.5 rounded-full shrink-0"
                     :class="statusBadge(b.status)"
                   >
                     {{ bookingStatusLabel(b.status) }}
                   </span>
                 </div>
                 <div class="text-sm text-gray-600">🗓 {{ formatDateTime(b.event.startsAt) }}</div>
                 <div v-if="b.event.venue || b.event.locationText" class="text-sm text-gray-500">
                   📍 {{ b.event.venue?.name || b.event.locationText }}
                 </div>
               </NuxtLink>
               <button
                 v-if="filter === 'upcoming' && canCancel(b)"
                 type="button"
                 class="mt-3 w-full border border-red-200 text-red-600 py-2 rounded-lg text-sm hover:bg-red-50"
                 :disabled="cancelling === b.id"
                 @click="onCancel(b)"
               >
                 {{ cancelling === b.id ? 'Отмена…' : 'Отменить запись' }}
               </button>
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
   const { listMy, cancel } = useBookings(orgId)
   const { formatDateTime } = useFormatters()

   const tabs = [
     { value: 'upcoming' as const, label: 'Предстоящие' },
     { value: 'past' as const, label: 'Прошедшие' },
   ]
   const filter = ref<'upcoming' | 'past'>('upcoming')
   const bookings = ref<any[]>([])
   const loading = ref(false)
   const cancelling = ref<number | null>(null)

   async function fetchList() {
     loading.value = true
     try {
       bookings.value = await listMy(filter.value)
     } finally {
       loading.value = false
     }
   }
   function setFilter(f: 'upcoming' | 'past') {
     filter.value = f
     fetchList()
   }

   function canCancel(b: any) {
     return ['confirmed', 'waitlisted', 'pending_payment'].includes(b.status)
   }
   async function onCancel(b: any) {
     if (!confirm('Отменить запись?')) return
     cancelling.value = b.id
     try {
       await cancel(b.id)
       await fetchList()
     } catch (e: any) {
       alert(translateError(e?.data?.code) ?? 'Не удалось отменить')
     } finally {
       cancelling.value = null
     }
   }

   function bookingStatusLabel(s: string) {
     return (
       {
         confirmed: 'Записан',
         waitlisted: 'Лист ожидания',
         pending_payment: 'Ждёт оплаты',
         attended: 'Посетил',
         no_show: 'Пропуск',
         cancelled: 'Отменено',
       }[s] ?? s
     )
   }
   function statusBadge(s: string) {
     return (
       {
         confirmed: 'bg-green-100 text-green-700',
         waitlisted: 'bg-orange-100 text-orange-700',
         pending_payment: 'bg-yellow-100 text-yellow-700',
         attended: 'bg-blue-100 text-blue-700',
         no_show: 'bg-gray-100 text-gray-600',
         cancelled: 'bg-gray-100 text-gray-500',
       }[s] ?? 'bg-gray-100 text-gray-600'
     )
   }
   function translateError(code?: string) {
     return (
       {
         'booking.deadline_passed': 'Срок отмены прошёл',
         'booking.cannot_cancel_others': 'Нельзя отменить чужую запись',
       }[code ?? ''] ?? null
     )
   }

   await fetchList()
   </script>
   ```

2. **Ссылка из dashboard** (`/m/orgs/[orgId]/index.vue` — добавить плитку «Мои записи»):
   ```vue
   <NuxtLink
     :to="`/m/orgs/${org.id}/my/bookings`"
     class="bg-white border rounded-lg p-4 hover:border-blue-300"
   >
     <div class="text-2xl mb-1">🎫</div>
     <div class="font-medium">Мои записи</div>
   </NuxtLink>
   ```

## Критерии приёмки

- ✅ Список записей с табами upcoming/past
- ✅ Карточка: title события, дата, место, badge статуса (русский)
- ✅ Клик → переход на событие
- ✅ Кнопка отмены только для upcoming + отменяемых статусов
- ✅ Отмена с confirm, обработка deadline_passed (перевод)
- ✅ Past показывает attended/no_show
- ✅ Loading/empty states
- ✅ Плитка «Мои записи» в dashboard

## Подсказки

- **deadline_passed обрабатывается** — игрок может попытаться отменить после дедлайна, backend вернёт ошибку, переводим.
- **canCancel** — клиентская проверка статуса; реальная проверка deadline на backend (5.6.1).
- **Badge цвета согласованы** с остальным UI (green confirmed, orange waitlist, yellow pending).

## Не делать

- ❌ Не показывать promoted-уведомления здесь — Phase 8
- ❌ Не делать историю изменений брони
- ❌ Не делать повторную запись из этого экрана (через страницу события)
