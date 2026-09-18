---
id: '5.9.3'
phase: '5'
epic: '5.9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - FE
depends_on:
  - '5.9.2'
  - '5.7.1'
estimated_hours: '2-3'
tags:
  - ui
  - bookings
  - mini-app
---

# Task 5.9.3: Booking flow (sheet выбора метода, запись/waitlist)

## Цель

Реализовать booking sheet: при «Записаться» открывается sheet снизу с выбором метода (абонемент / оплата на месте), дефолт — абонемент если есть сессии. Запись через API, обработка confirmed/waitlisted результата.

## Контекст

Решение 1: sheet с радио-выбором, дефолт абонемент. Решение 2: если заполнено — кнопка уже «В лист ожидания» (5.9.2), но sheet тот же. Бесплатное событие — без выбора метода.

## Что должно быть сделано

1. **Composable `apps/web/composables/useBookings.ts`:**

   ```ts
   export function useBookings(orgId: Ref<number> | number) {
     const orgIdRef = isRef(orgId) ? orgId : ref(orgId)

     async function book(eventId: number, method: string, subscriptionId?: number) {
       return $fetch<{ booking: any }>(
         `/api/organizations/${orgIdRef.value}/events/${eventId}/book`,
         { method: 'POST', body: { method, subscriptionId } },
       )
     }

     async function cancel(bookingId: number) {
       return $fetch<{ booking: any; promoted: any }>(
         `/api/organizations/${orgIdRef.value}/bookings/${bookingId}`,
         { method: 'DELETE' },
       )
     }

     async function listMy(filter: 'upcoming' | 'past' | 'all' = 'upcoming') {
       const data = await $fetch<{ bookings: any[] }>(
         `/api/organizations/${orgIdRef.value}/my/bookings`,
         { query: { filter } },
       )
       return data.bookings
     }

     return { book, cancel, listMy }
   }
   ```

2. **Компонент `apps/web/components/BookingSheet.vue`:**

   ```vue
   <template>
     <div
       class="fixed inset-0 bg-black/50 z-30 flex items-end justify-center"
       @click="$emit('close')"
     >
       <div class="bg-white rounded-t-2xl w-full max-w-md p-6" @click.stop>
         <h2 class="text-lg font-semibold mb-1">
           {{ isFull ? 'Встать в лист ожидания' : 'Записаться на событие' }}
         </h2>
         <p class="text-sm text-gray-500 mb-4">{{ event.title }}</p>

         <!-- Бесплатное событие — без выбора -->
         <div
           v-if="event.price === 0"
           class="mb-4 text-sm text-green-700 bg-green-50 px-3 py-2 rounded"
         >
           Это бесплатное событие
         </div>

         <!-- Выбор метода -->
         <div v-else class="space-y-2 mb-4">
           <label
             v-if="activeSubscriptions.length > 0"
             class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer"
             :class="method === 'subscription' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'"
           >
             <input v-model="method" type="radio" value="subscription" class="mt-1" />
             <div class="flex-1">
               <div class="font-medium">С абонемента</div>
               <div class="text-xs text-gray-500">
                 Осталось {{ totalRemaining }} {{ pluralSessions(totalRemaining) }}
               </div>
               <select
                 v-if="method === 'subscription' && activeSubscriptions.length > 1"
                 v-model.number="selectedSubId"
                 class="mt-2 w-full border rounded px-2 py-1 text-sm"
                 @click.prevent.stop
               >
                 <option v-for="s in activeSubscriptions" :key="s.id" :value="s.id">
                   {{ s.plan.name }} — осталось {{ s.remainingSessions
                   }}{{ s.expiresAt ? `, до ${formatDate(s.expiresAt)}` : '' }}
                 </option>
               </select>
             </div>
           </label>

           <label
             class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer"
             :class="method === 'cash' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'"
           >
             <input v-model="method" type="radio" value="cash" class="mt-1" />
             <div>
               <div class="font-medium">Оплата на месте</div>
               <div class="text-xs text-gray-500">
                 {{ formatPrice(event.price, event.currency) }} — подтвердит организатор
               </div>
             </div>
           </label>
         </div>

         <div v-if="isFull" class="mb-4 text-sm text-orange-700 bg-orange-50 px-3 py-2 rounded">
           Мест нет — вы попадёте в лист ожидания. Если место освободится, вы автоматически попадёте
           в состав.
         </div>

         <div class="flex gap-2">
           <button type="button" class="flex-1 border py-2.5 rounded-lg" @click="$emit('close')">
             Отмена
           </button>
           <button
             type="button"
             class="flex-1 text-white py-2.5 rounded-lg disabled:opacity-50"
             :class="isFull ? 'bg-orange-500' : 'bg-blue-500'"
             :disabled="submitting || !canSubmit"
             @click="onConfirm"
           >
             {{ submitting ? 'Запись…' : isFull ? 'В лист ожидания' : 'Записаться' }}
           </button>
         </div>
         <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
       </div>
     </div>
   </template>

   <script setup lang="ts">
   const props = defineProps<{
     event: any
     orgId: number
     activeSubscriptions: any[]
   }>()
   const emit = defineEmits<{ close: []; booked: [result: any] }>()

   const { book } = useBookings(props.orgId)
   const { formatPrice, formatDate } = useFormatters()

   const isFull = computed(() => props.event.confirmedCount >= props.event.capacity)
   const totalRemaining = computed(() =>
     props.activeSubscriptions.reduce((s, x) => s + x.remainingSessions, 0),
   )

   // Дефолт: абонемент если есть сессии, иначе cash
   const method = ref<string>(
     props.event.price === 0 ? 'free' : totalRemaining.value > 0 ? 'subscription' : 'cash',
   )
   const selectedSubId = ref<number | undefined>(props.activeSubscriptions[0]?.id)
   const submitting = ref(false)
   const error = ref('')

   const canSubmit = computed(() => {
     if (props.event.price === 0) return true
     if (method.value === 'subscription') return totalRemaining.value > 0
     return true
   })

   async function onConfirm() {
     submitting.value = true
     error.value = ''
     try {
       const effectiveMethod = props.event.price === 0 ? 'free' : method.value
       const subId = effectiveMethod === 'subscription' ? selectedSubId.value : undefined
       const result = await book(props.event.id, effectiveMethod, subId)
       emit('booked', result.booking)
     } catch (e: any) {
       error.value =
         translateError(e?.data?.code) ?? e?.data?.statusMessage ?? 'Не удалось записаться'
     } finally {
       submitting.value = false
     }
   }

   function pluralSessions(n: number): string {
     const mod10 = n % 10,
       mod100 = n % 100
     if (mod10 === 1 && mod100 !== 11) return 'занятие'
     if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'занятия'
     return 'занятий'
   }
   function translateError(code?: string): string | null {
     return (
       {
         'booking.already_booked': 'Вы уже записаны на это событие',
         'booking.event_not_bookable': 'Запись на это событие недоступна',
         'booking.no_active_subscription': 'Нет активного абонемента со свободными занятиями',
         'subscription.no_active': 'Нет активного абонемента',
       }[code ?? ''] ?? null
     )
   }
   </script>
   ```

3. **Подключить в странице события (5.9.2)** — заменить заглушки handlers:

   ```ts
   const showBookingSheet = ref(false)
   const activeSubscriptions = ref<any[]>([])
   const { cancel } = useBookings(orgId)

   async function loadSubscriptions() {
     const data = await $fetch<{ subscriptions: any[] }>(
       `/api/organizations/${orgId}/my/subscriptions`,
     )
     activeSubscriptions.value = data.subscriptions
   }

   function onBookClick() {
     showBookingSheet.value = true
   }

   async function onBooked(booking: any) {
     showBookingSheet.value = false
     await load() // reload event + myBooking
   }

   async function onCancelClick() {
     if (!myBooking.value) return
     if (!confirm('Отменить запись?')) return
     const result = await cancel(myBooking.value.id)
     await load()
     if (result.promoted) {
       // опционально: тост «Из листа ожидания продвинут игрок»
     }
   }

   onMounted(loadSubscriptions)
   ```

   В template добавить:

   ```vue
   <BookingSheet
     v-if="showBookingSheet"
     :event="event"
     :org-id="orgId"
     :active-subscriptions="activeSubscriptions"
     @close="showBookingSheet = false"
     @booked="onBooked"
   />
   ```

## Критерии приёмки

- ✅ useBookings: book, cancel, listMy
- ✅ Sheet открывается по «Записаться»/«В лист ожидания»
- ✅ Бесплатное событие → без выбора метода, method=free
- ✅ Платное: радио абонемент (если есть сессии, дефолт) / оплата на месте
- ✅ Несколько абонементов → select какой использовать (с остатком и сроком)
- ✅ Заполнено → предупреждение про лист ожидания, кнопка orange
- ✅ Успех → sheet закрывается, страница обновляется
- ✅ Ошибки переведены на русский (already_booked, no_active_subscription)
- ✅ Отмена с confirm, обработка promoted в ответе
- ✅ Правильная плюрализация «занятие/занятия/занятий»

## Подсказки

- **Дефолт метода:** subscription если totalRemaining > 0, иначе cash. Бесплатное → free сразу.
- **subscriptionId опционален:** если не указан, backend выберет FIFO. Но даём выбор при нескольких абонементах (UX-прозрачность).
- **translateError по code** — backend возвращает data.code, UI переводит. Это паттерн локализации (решение 5: коды на backend, русский в UI).
- **promoted в ответе cancel** — можно показать тост, но не обязательно в Phase 5.

## Не делать

- ❌ Не делать реальную оплату — Phase 6 (cash = pending_payment, подтвердит организатор)
- ❌ Не делать онлайн-оплату — Phase 12
- ❌ Не делать выбор конкретного места/позиции (нет нумерации мест)
