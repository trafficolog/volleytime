---
id: '5.10.3'
phase: '5'
epic: '5.10'
status: todo
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Не реализовано в v0.1.0 (ревью 2026-09-16); закрывается фикс-эпиком 5.13.'
roles:
  - FE
depends_on:
  - '5.7.1'
  - '5.3.4'
estimated_hours: '1-2'
tags:
  - ui
  - bookings
  - attendance
  - admin
---

# Task 5.10.3: Список записей события + bulk attendance

## Цель

Страница `/m/orgs/:orgId/events/:id/bookings` (admin) — список записей по группам (confirmed/waitlist/pending), отметка посещаемости чекбоксами, сохранение bulk.

## Контекст

Решение 6: attendance через чекбоксы/тогглы по списку confirmed + кнопка «Сохранить» (bulk). Backend bulk endpoint в 5.3.4. Организатор после события отмечает кто пришёл.

## Что должно быть сделано

1. **Расширить useBookings** — admin методы:

   ```ts
   async function listForEvent(eventId: number) {
     // grouped response from API (5.7.1)
     return $fetch<{
       confirmed: any[]
       waitlisted: any[]
       pendingPayment: any[]
       attended: any[]
       noShow: any[]
       cancelled: any[]
     }>(`/api/organizations/${orgIdRef.value}/events/${eventId}/bookings`)
   }
   async function markAttendance(bookingId: number, attendance: 'attended' | 'no_show') {
     return $fetch(`/api/organizations/${orgIdRef.value}/bookings/${bookingId}/attendance`, {
       method: 'PATCH',
       body: { attendance },
     })
   }
   ```

2. **Страница `pages/m/orgs/[orgId]/events/[eventId]/bookings/index.vue`:**

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen pb-24">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <button type="button" @click="$router.back()" class="text-blue-500">←</button>
           <h1 class="text-lg font-semibold">Записи</h1>
         </header>

         <main v-if="data" class="px-4 py-4 space-y-6">
           <!-- Confirmed с attendance -->
           <section>
             <h2 class="text-sm font-semibold text-gray-500 uppercase mb-2">
               В составе ({{ data.confirmed.length }})
             </h2>
             <ul class="space-y-2">
               <li
                 v-for="b in data.confirmed"
                 :key="b.id"
                 class="bg-white border rounded-lg p-3 flex items-center justify-between"
               >
                 <div>
                   <div class="font-medium">{{ b.user.name || `User ${b.userId}` }}</div>
                   <div class="text-xs text-gray-500">{{ methodLabel(b.method) }}</div>
                 </div>
                 <div class="flex gap-1">
                   <button
                     type="button"
                     class="px-3 py-1 text-xs rounded-lg border"
                     :class="
                       attendance[b.id] === 'attended'
                         ? 'bg-green-500 text-white border-green-500'
                         : 'border-gray-200'
                     "
                     @click="toggle(b.id, 'attended')"
                   >
                     Был
                   </button>
                   <button
                     type="button"
                     class="px-3 py-1 text-xs rounded-lg border"
                     :class="
                       attendance[b.id] === 'no_show'
                         ? 'bg-gray-500 text-white border-gray-500'
                         : 'border-gray-200'
                     "
                     @click="toggle(b.id, 'no_show')"
                   >
                     Не был
                   </button>
                 </div>
               </li>
             </ul>
             <div v-if="data.confirmed.length === 0" class="text-sm text-gray-400 py-2">
               Никто не записан
             </div>
           </section>

           <!-- Waitlist -->
           <section v-if="data.waitlisted.length > 0">
             <h2 class="text-sm font-semibold text-gray-500 uppercase mb-2">
               Лист ожидания ({{ data.waitlisted.length }})
             </h2>
             <ul class="space-y-2">
               <li
                 v-for="(b, idx) in data.waitlisted"
                 :key="b.id"
                 class="bg-orange-50 border border-orange-100 rounded-lg p-3 flex items-center gap-3"
               >
                 <span class="text-orange-500 font-semibold">{{ idx + 1 }}</span>
                 <div class="font-medium">{{ b.user.name || `User ${b.userId}` }}</div>
               </li>
             </ul>
           </section>

           <!-- Pending payment -->
           <section v-if="data.pendingPayment.length > 0">
             <h2 class="text-sm font-semibold text-gray-500 uppercase mb-2">
               Ждут оплаты ({{ data.pendingPayment.length }})
             </h2>
             <ul class="space-y-2">
               <li
                 v-for="b in data.pendingPayment"
                 :key="b.id"
                 class="bg-yellow-50 border border-yellow-100 rounded-lg p-3"
               >
                 <div class="font-medium">{{ b.user.name || `User ${b.userId}` }}</div>
                 <div class="text-xs text-gray-500">
                   {{ methodLabel(b.method) }} · подтверждение оплаты — в следующем обновлении
                 </div>
               </li>
             </ul>
           </section>
         </main>

         <!-- Save attendance bar -->
         <div v-if="hasChanges" class="fixed bottom-0 inset-x-0 bg-white border-t p-4">
           <button
             type="button"
             class="w-full bg-blue-500 text-white py-3 rounded-lg font-medium disabled:opacity-50"
             :disabled="saving"
             @click="saveAttendance"
           >
             {{ saving ? 'Сохранение…' : 'Сохранить посещаемость' }}
           </button>
         </div>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const route = useRoute()
   const orgId = computed(() => Number(route.params.orgId))
   const eventId = Number(route.params.eventId)
   const { listForEvent, markAttendance } = useBookings(orgId)

   const data = ref<any>(null)
   const attendance = ref<Record<number, 'attended' | 'no_show'>>({})
   const initialAttendance = ref<Record<number, string>>({})
   const saving = ref(false)

   async function load() {
     data.value = await listForEvent(eventId)
     // инициализация из текущих статусов (attended/no_show уже отмеченных)
     attendance.value = {}
     initialAttendance.value = {}
     for (const b of [...data.value.confirmed, ...data.value.attended, ...data.value.noShow]) {
       if (b.status === 'attended') {
         attendance.value[b.id] = 'attended'
         initialAttendance.value[b.id] = 'attended'
       }
       if (b.status === 'no_show') {
         attendance.value[b.id] = 'no_show'
         initialAttendance.value[b.id] = 'no_show'
       }
     }
   }

   const hasChanges = computed(() =>
     Object.keys(attendance.value).some(
       (id) => attendance.value[+id] !== initialAttendance.value[+id],
     ),
   )

   function toggle(bookingId: number, value: 'attended' | 'no_show') {
     attendance.value[bookingId] =
       attendance.value[bookingId] === value ? (undefined as any) : value
   }

   async function saveAttendance() {
     saving.value = true
     try {
       const changes = Object.entries(attendance.value).filter(
         ([id, v]) => v && v !== initialAttendance.value[+id],
       )
       for (const [id, v] of changes) {
         await markAttendance(Number(id), v as 'attended' | 'no_show')
       }
       await load()
     } finally {
       saving.value = false
     }
   }

   function methodLabel(m: string) {
     return (
       {
         subscription: 'Абонемент',
         cash: 'Оплата на месте',
         transfer: 'Перевод',
         online: 'Онлайн',
         free: 'Бесплатно',
       }[m] ?? m
     )
   }

   await load()
   </script>
   ```

3. **Ссылка из страницы события** (для admin) — кнопка «Управление записями» если canManageContent.

## Критерии приёмки

- ✅ Список сгруппирован: в составе (confirmed), лист ожидания (с номерами очереди), ждут оплаты
- ✅ Confirmed: тогглы «Был»/«Не был» (attended/no_show)
- ✅ Повторный тап снимает отметку
- ✅ Уже отмеченные подгружаются как начальное состояние
- ✅ Кнопка «Сохранить» появляется только при изменениях (hasChanges)
- ✅ Bulk сохранение (несколько markAttendance)
- ✅ Waitlist показывает порядок очереди (номера)
- ✅ Pending payment с пометкой «подтверждение — в следующем обновлении» (Phase 6)
- ✅ Только owner/organizer
- ✅ method переведён на русский

## Подсказки

- **bulk через цикл markAttendance:** в 5.3.4 есть markAttendanceBulk на backend, но можно и циклом отдельных PATCH (проще для UI, объёмы малые). Если нужен один запрос — добавить bulk-endpoint.
- **hasChanges** — кнопка сохранения только при реальных изменениях относительно initial.
- **Waitlist номера** — порядок промоушена (FIFO по bookedAt), backend отдаёт отсортированным (5.3.3).
- **Pending payment** — в Phase 5 организатор видит, но подтвердить оплату не может (это Phase 6). Явная пометка.

## Не делать

- ❌ Не делать confirm оплаты — Phase 6
- ❌ Не делать ручное добавление игрока (booking за игрока) — Phase 14+
- ❌ Не делать экспорт списка — Phase 14
- ❌ Не делать ручной промоушн из waitlist (автоматический при отмене)
