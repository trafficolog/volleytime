---
id: '5.9.1'
phase: '5'
epic: '5.9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - FE
depends_on:
  - '5.2.4'
estimated_hours: '2'
tags:
  - ui
  - events
  - mini-app
---

# Task 5.9.1: useEvents composable + список событий с индикаторами

## Цель

Composable `useEvents` + страница `/m/orgs/:orgId/events` со списком событий (upcoming/past табы), индикаторами заполненности (числа + прогресс-бар + badge).

## Контекст

Первый player-экран Phase 5. Переиспользует паттерны Phase 4 (useState composable, Mini App layout, табы как в members 4.7.3). Индикатор по решению 3: «8/12 мест» + прогресс-бар + badge.

## Что должно быть сделано

1. **Composable `apps/web/composables/useEvents.ts`:**

   ```ts
   interface EventListItem {
     id: number
     type: 'training' | 'open_game' | 'tournament_match' | 'custom'
     title: string
     locationText: string | null
     startsAt: string
     endsAt: string
     capacity: number
     price: number
     currency: string
     status: string
     confirmedCount: number
     waitlistCount: number
     availableSpots: number
     venue: { id: number; name: string } | null
   }

   export function useEvents(orgId: Ref<number> | number) {
     const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
     const events = ref<EventListItem[]>([])
     const loading = ref(false)

     async function fetchList(filter: 'upcoming' | 'past' | 'all' = 'upcoming') {
       loading.value = true
       try {
         const data = await $fetch<{ events: EventListItem[] }>(
           `/api/organizations/${orgIdRef.value}/events`,
           { query: { filter } },
         )
         events.value = data.events
       } finally {
         loading.value = false
       }
     }

     async function getEvent(eventId: number) {
       const data = await $fetch<{ event: EventListItem }>(
         `/api/organizations/${orgIdRef.value}/events/${eventId}`,
       )
       return data.event
     }

     return { events, loading, fetchList, getEvent }
   }
   ```

2. **Shared formatters `apps/web/composables/useFormatters.ts`:**

   ```ts
   export function useFormatters() {
     function formatPrice(price: number, currency: string): string {
       if (price === 0) return 'Бесплатно'
       return `${(price / 100).toFixed(2)} ${currency}`
     }
     function formatDateTime(iso: string): string {
       return new Date(iso).toLocaleString('ru-RU', {
         day: 'numeric',
         month: 'long',
         hour: '2-digit',
         minute: '2-digit',
       })
     }
     function formatDate(iso: string): string {
       return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
     }
     function formatTime(iso: string): string {
       return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
     }
     return { formatPrice, formatDateTime, formatDate, formatTime }
   }
   ```

3. **Компонент индикатора `apps/web/components/EventCapacityBar.vue`:**

   ```vue
   <template>
     <div>
       <div class="flex items-center justify-between text-sm mb-1">
         <span class="text-gray-600">{{ confirmedCount }}/{{ capacity }} мест</span>
         <span v-if="isFull" class="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
           Лист ожидания{{ waitlistCount > 0 ? ` · ${waitlistCount}` : '' }}
         </span>
         <span v-else class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
           Есть места
         </span>
       </div>
       <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
         <div
           class="h-full rounded-full transition-all"
           :class="isFull ? 'bg-orange-500' : 'bg-blue-500'"
           :style="{ width: `${fillPercent}%` }"
         />
       </div>
     </div>
   </template>

   <script setup lang="ts">
   const props = defineProps<{
     confirmedCount: number
     capacity: number
     waitlistCount: number
   }>()
   const isFull = computed(() => props.confirmedCount >= props.capacity)
   const fillPercent = computed(() =>
     Math.min(100, Math.round((props.confirmedCount / props.capacity) * 100)),
   )
   </script>
   ```

4. **Страница `apps/web/pages/m/orgs/[orgId]/events/index.vue`:**
   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <NuxtLink :to="`/m/orgs/${orgId}`" class="text-blue-500">←</NuxtLink>
           <h1 class="text-lg font-semibold">События</h1>
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

           <div v-else-if="events.length === 0" class="text-center py-12 text-gray-500">
             {{ filter === 'upcoming' ? 'Нет предстоящих событий' : 'Нет событий' }}
           </div>

           <ul v-else class="space-y-3">
             <li v-for="e in events" :key="e.id">
               <NuxtLink
                 :to="`/m/orgs/${orgId}/events/${e.id}`"
                 class="block bg-white border rounded-lg p-4 hover:border-blue-300"
               >
                 <div class="flex items-start justify-between gap-2 mb-2">
                   <div class="font-medium">{{ e.title }}</div>
                   <div class="text-sm text-gray-500 shrink-0">
                     {{ formatPrice(e.price, e.currency) }}
                   </div>
                 </div>
                 <div class="text-sm text-gray-600 mb-1">🗓 {{ formatDateTime(e.startsAt) }}</div>
                 <div v-if="e.venue || e.locationText" class="text-sm text-gray-500 mb-3">
                   📍 {{ e.venue?.name || e.locationText }}
                 </div>
                 <EventCapacityBar
                   :confirmed-count="e.confirmedCount"
                   :capacity="e.capacity"
                   :waitlist-count="e.waitlistCount"
                 />
               </NuxtLink>
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
   const { events, loading, fetchList } = useEvents(orgId)
   const { formatPrice, formatDateTime } = useFormatters()

   const tabs = [
     { value: 'upcoming' as const, label: 'Предстоящие' },
     { value: 'past' as const, label: 'Прошедшие' },
   ]
   const filter = ref<'upcoming' | 'past'>('upcoming')

   function setFilter(f: 'upcoming' | 'past') {
     filter.value = f
     fetchList(f)
   }

   await fetchList('upcoming')
   </script>
   ```

## Критерии приёмки

- ✅ useEvents composable: fetchList (фильтр), getEvent
- ✅ useFormatters: цена (0→«Бесплатно», иначе X.XX BYN), дата/время на русском
- ✅ EventCapacityBar: «8/12 мест» + прогресс-бар (blue/orange) + badge («Есть места»/«Лист ожидания»)
- ✅ Список с табами upcoming/past
- ✅ Карточка: title, цена, дата, место, индикатор заполненности
- ✅ Loading/empty states
- ✅ Клик → переход на страницу события
- ✅ Mobile-first, blue primary + orange accent

## Подсказки

- **price/100:** backend хранит в минимальных единицах (1500 = 15.00 BYN). Formatter делит.
- **EventCapacityBar переиспользуется** на странице события (5.9.2) и в admin (5.10).
- **Прогресс-бар цвет:** blue если есть места, orange если заполнено (waitlist режим).
- **useFormatters shared** — используется во всех Phase 5 UI задачах.

## Не делать

- ❌ Не делать поиск/фильтры по типу — Phase 14+
- ❌ Не делать календарный вид — Phase 14+
- ❌ Не делать pagination (событий обычно немного на экран)
