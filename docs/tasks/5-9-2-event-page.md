---
id: '5.9.2'
phase: '5'
epic: '5.9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - FE
depends_on:
  - '5.9.1'
estimated_hours: '2'
tags:
  - ui
  - events
  - mini-app
---

# Task 5.9.2: Страница события + заполненность

## Цель

Страница `/m/orgs/:orgId/events/:id` — детали события, индикатор заполненности, состояние записи текущего игрока, кнопка записи/отмены (booking flow — в 5.9.3).

## Контекст

Центральный экран взаимодействия. Показывает всё о событии + текущий статус игрока (записан/в листе/не записан) и соответствующую кнопку. Сам booking flow (sheet выбора метода) — следующая задача 5.9.3, здесь — страница и определение состояния.

## Что должно быть сделано

1. **Расширить useEvents** — получение моей брони на событие:

   ```ts
   // в useBookings (создаётся в 5.9.4, но myBookingForEvent нужен здесь)
   async function getMyBookingForEvent(orgId: number, eventId: number) {
     const data = await $fetch<{ bookings: any[] }>(`/api/organizations/${orgId}/my/bookings`, {
       query: { filter: 'all' },
     })
     return data.bookings.find((b) => b.eventId === eventId && b.status !== 'cancelled') ?? null
   }
   ```

2. **Страница `apps/web/pages/m/orgs/[orgId]/events/[eventId]/index.vue`:**

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen pb-24">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <button type="button" @click="$router.back()" class="text-blue-500">←</button>
           <h1 class="text-lg font-semibold truncate flex-1">Событие</h1>
         </header>

         <main v-if="event" class="px-4 py-4 space-y-4">
           <div>
             <div class="text-xs text-gray-400 uppercase mb-1">{{ typeLabel(event.type) }}</div>
             <h2 class="text-xl font-bold">{{ event.title }}</h2>
           </div>

           <div class="bg-white border rounded-lg p-4 space-y-2">
             <div class="flex items-center gap-2 text-sm">
               <span>🗓</span
               ><span>{{ formatDateTime(event.startsAt) }} – {{ formatTime(event.endsAt) }}</span>
             </div>
             <div v-if="event.venue || event.locationText" class="flex items-center gap-2 text-sm">
               <span>📍</span><span>{{ event.venue?.name || event.locationText }}</span>
             </div>
             <div class="flex items-center gap-2 text-sm">
               <span>💰</span><span>{{ formatPrice(event.price, event.currency) }}</span>
             </div>
             <div
               v-if="event.cancellationDeadlineHours != null"
               class="flex items-center gap-2 text-sm text-gray-500"
             >
               <span>⏱</span
               ><span>Отмена не позднее чем за {{ event.cancellationDeadlineHours }} ч</span>
             </div>
           </div>

           <div v-if="event.description" class="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
             {{ event.description }}
           </div>

           <div class="bg-white border rounded-lg p-4">
             <EventCapacityBar
               :confirmed-count="event.confirmedCount"
               :capacity="event.capacity"
               :waitlist-count="event.waitlistCount"
             />
           </div>

           <!-- Текущий статус игрока -->
           <div
             v-if="myBooking"
             class="rounded-lg p-4 text-center"
             :class="statusBg(myBooking.status)"
           >
             <div class="font-medium">{{ bookingStatusLabel(myBooking.status) }}</div>
           </div>
         </main>

         <!-- Sticky action bar -->
         <div v-if="event && canAct" class="fixed bottom-0 inset-x-0 bg-white border-t p-4">
           <BookingActionButton
             :event="event"
             :my-booking="myBooking"
             @book="onBookClick"
             @cancel="onCancelClick"
           />
         </div>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const route = useRoute()
   const orgId = Number(route.params.orgId)
   const eventId = Number(route.params.eventId)
   const { getEvent } = useEvents(orgId)
   const { formatPrice, formatDateTime, formatTime } = useFormatters()

   const event = ref<any>(null)
   const myBooking = ref<any>(null)

   const canAct = computed(
     () =>
       event.value &&
       ['published'].includes(event.value.status) &&
       new Date(event.value.startsAt) > new Date(),
   )

   async function load() {
     event.value = await getEvent(eventId)
     const data = await $fetch<{ bookings: any[] }>(`/api/organizations/${orgId}/my/bookings`, {
       query: { filter: 'all' },
     })
     myBooking.value =
       data.bookings.find((b) => b.eventId === eventId && b.status !== 'cancelled') ?? null
   }

   // booking/cancel handlers — детали в 5.9.3
   function onBookClick() {
     /* открыть booking sheet (5.9.3) */
   }
   async function onCancelClick() {
     /* cancel flow (5.9.3) */
   }

   function typeLabel(t: string) {
     return (
       {
         training: 'Тренировка',
         open_game: 'Открытая игра',
         tournament_match: 'Матч',
         custom: 'Событие',
       }[t] ?? t
     )
   }
   function bookingStatusLabel(s: string) {
     return (
       {
         confirmed: '✓ Вы записаны',
         waitlisted: '⏳ Вы в листе ожидания',
         pending_payment: '💳 Ждёт оплаты',
         attended: 'Вы посетили',
         no_show: 'Отмечен пропуск',
       }[s] ?? s
     )
   }
   function statusBg(s: string) {
     return (
       {
         confirmed: 'bg-green-50 text-green-700',
         waitlisted: 'bg-orange-50 text-orange-700',
         pending_payment: 'bg-yellow-50 text-yellow-700',
       }[s] ?? 'bg-gray-50 text-gray-700'
     )
   }

   await load()
   provide('reloadEvent', load) // для booking sheet
   </script>
   ```

3. **Компонент `BookingActionButton.vue`** — определяет какую кнопку показать:
   ```vue
   <template>
     <button
       v-if="!myBooking"
       type="button"
       class="w-full py-3 rounded-lg font-medium text-white"
       :class="isFull ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'"
       @click="$emit('book')"
     >
       {{ isFull ? 'Встать в лист ожидания' : 'Записаться' }}
     </button>
     <button
       v-else-if="canCancel"
       type="button"
       class="w-full py-3 rounded-lg font-medium border border-red-300 text-red-600 hover:bg-red-50"
       @click="$emit('cancel')"
     >
       Отменить запись
     </button>
   </template>

   <script setup lang="ts">
   const props = defineProps<{ event: any; myBooking: any }>()
   defineEmits<{ book: []; cancel: [] }>()
   const isFull = computed(() => props.event.confirmedCount >= props.event.capacity)
   const canCancel = computed(() =>
     ['confirmed', 'waitlisted', 'pending_payment'].includes(props.myBooking?.status),
   )
   </script>
   ```

## Критерии приёмки

- ✅ Страница показывает: тип, title, дата/время, место, цена, deadline отмены, описание
- ✅ EventCapacityBar с заполненностью
- ✅ Если игрок записан — статус-баннер (записан/в листе/ждёт оплаты) на русском
- ✅ Sticky action bar внизу с кнопкой
- ✅ Кнопка: «Записаться» (blue) если есть места, «Встать в лист ожидания» (orange) если заполнено
- ✅ Если уже записан → «Отменить запись» (red)
- ✅ Кнопки скрыты если событие cancelled/finished/началось
- ✅ Booking/cancel handlers — заглушки (реализация в 5.9.3)

## Подсказки

- **provide('reloadEvent', load)** — booking sheet (5.9.3) вызовет после успешной записи для обновления.
- **canAct:** только published и не начавшиеся события позволяют действия.
- **Sticky bottom bar** — типичный mobile паттерн, кнопка всегда видна.
- **myBooking ищем среди всех (filter=all), исключая cancelled** — чтобы повторно записаться после отмены.

## Не делать

- ❌ Не реализовывать booking sheet — это 5.9.3
- ❌ Не показывать список участников игроку (это admin view 5.10)
- ❌ Не делать «поделиться событием» — Phase 8+
