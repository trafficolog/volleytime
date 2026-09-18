---
id: '5.10.1'
phase: '5'
epic: '5.10'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - FE
depends_on:
  - '5.2.4'
  - '5.1.2'
estimated_hours: '2-3'
tags:
  - ui
  - events
  - venues
  - admin
---

# Task 5.10.1: Форма создания/редактирования события + venues management

## Цель

Форма создания/редактирования события (Mini App + Web). Управление площадками (venues). Выбор venue или текстовый адрес.

## Контекст

Организатор создаёт события. Форма: title, type, дата/время, venue (select из существующих или текст), capacity, price, cancellation deadline. Решение 4: Web-версия для удобного заполнения с десктопа (те же компоненты, layout default).

## Что должно быть сделано

1. **Composable `apps/web/composables/useVenues.ts`:**

   ```ts
   export function useVenues(orgId: Ref<number> | number) {
     const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
     const venues = ref<any[]>([])

     async function fetchAll() {
       const data = await $fetch<{ venues: any[] }>(`/api/organizations/${orgIdRef.value}/venues`)
       venues.value = data.venues
     }
     async function create(input: {
       name: string
       address?: string
       capacityHint?: number
       notes?: string
     }) {
       const data = await $fetch<{ venue: any }>(`/api/organizations/${orgIdRef.value}/venues`, {
         method: 'POST',
         body: input,
       })
       await fetchAll()
       return data.venue
     }
     async function update(id: number, input: any) {
       await $fetch(`/api/organizations/${orgIdRef.value}/venues/${id}`, {
         method: 'PATCH',
         body: input,
       })
       await fetchAll()
     }
     async function archive(id: number) {
       await $fetch(`/api/organizations/${orgIdRef.value}/venues/${id}`, { method: 'DELETE' })
       await fetchAll()
     }
     return { venues, fetchAll, create, update, archive }
   }
   ```

2. **Расширить useEvents** — create/update:

   ```ts
   async function createEvent(input: any) {
     const data = await $fetch<{ event: any }>(`/api/organizations/${orgIdRef.value}/events`, {
       method: 'POST',
       body: input,
     })
     return data.event
   }
   async function updateEvent(eventId: number, input: any) {
     const data = await $fetch<{ event: any }>(
       `/api/organizations/${orgIdRef.value}/events/${eventId}`,
       { method: 'PATCH', body: input },
     )
     return data.event
   }
   async function cancelEvent(eventId: number) {
     return $fetch(`/api/organizations/${orgIdRef.value}/events/${eventId}/cancel`, {
       method: 'POST',
     })
   }
   ```

3. **Форма-компонент `apps/web/components/EventForm.vue`** (переиспользуется Mini App и Web):

   ```vue
   <template>
     <form @submit.prevent="onSubmit" class="space-y-4">
       <div>
         <label class="block text-sm font-medium mb-1">Название *</label>
         <input
           v-model="form.title"
           type="text"
           required
           minlength="2"
           maxlength="200"
           class="w-full border rounded-lg px-3 py-2"
           :disabled="submitting"
           placeholder="Тренировка по волейболу"
         />
       </div>

       <div>
         <label class="block text-sm font-medium mb-1">Тип</label>
         <select v-model="form.type" class="w-full border rounded-lg px-3 py-2">
           <option value="training">Тренировка</option>
           <option value="open_game">Открытая игра</option>
         </select>
       </div>

       <div class="grid grid-cols-2 gap-3">
         <div>
           <label class="block text-sm font-medium mb-1">Начало *</label>
           <input
             v-model="form.startsAt"
             type="datetime-local"
             required
             class="w-full border rounded-lg px-3 py-2"
           />
         </div>
         <div>
           <label class="block text-sm font-medium mb-1">Конец *</label>
           <input
             v-model="form.endsAt"
             type="datetime-local"
             required
             class="w-full border rounded-lg px-3 py-2"
           />
         </div>
       </div>

       <div>
         <label class="block text-sm font-medium mb-1">Площадка</label>
         <select v-model="form.venueId" class="w-full border rounded-lg px-3 py-2 mb-2">
           <option :value="null">— Указать адрес вручную —</option>
           <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option>
         </select>
         <input
           v-if="!form.venueId"
           v-model="form.locationText"
           type="text"
           maxlength="300"
           class="w-full border rounded-lg px-3 py-2"
           placeholder="Адрес: ул. Спортивная, 1"
         />
       </div>

       <div class="grid grid-cols-2 gap-3">
         <div>
           <label class="block text-sm font-medium mb-1">Вместимость *</label>
           <input
             v-model.number="form.capacity"
             type="number"
             required
             min="1"
             max="500"
             class="w-full border rounded-lg px-3 py-2"
           />
         </div>
         <div>
           <label class="block text-sm font-medium mb-1">Цена ({{ form.currency }})</label>
           <input
             v-model.number="priceMajor"
             type="number"
             min="0"
             step="0.01"
             class="w-full border rounded-lg px-3 py-2"
             placeholder="0 = бесплатно"
           />
         </div>
       </div>

       <div>
         <label class="block text-sm font-medium mb-1">Дедлайн отмены (часов до начала)</label>
         <input
           v-model.number="form.cancellationDeadlineHours"
           type="number"
           min="0"
           max="720"
           class="w-full border rounded-lg px-3 py-2"
           placeholder="Пусто = без дедлайна"
         />
         <p class="text-xs text-gray-500 mt-1">
           За сколько часов до начала закрыть отмену. Пусто — отмена всегда разрешена.
         </p>
       </div>

       <div>
         <label class="block text-sm font-medium mb-1">Описание</label>
         <textarea
           v-model="form.description"
           rows="3"
           maxlength="2000"
           class="w-full border rounded-lg px-3 py-2"
         ></textarea>
       </div>

       <div v-if="error" class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{{ error }}</div>

       <button
         type="submit"
         class="w-full bg-blue-500 text-white py-3 rounded-lg font-medium disabled:opacity-50"
         :disabled="submitting"
       >
         {{ submitting ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать событие' }}
       </button>
     </form>
   </template>

   <script setup lang="ts">
   import { errorMessage } from '~/utils/labels'

   const props = defineProps<{ orgId: number; eventId?: number; initial?: any }>()
   const emit = defineEmits<{ saved: [event: any] }>()

   const { venues, fetchAll } = useVenues(props.orgId)
   const { createEvent, updateEvent } = useEvents(props.orgId)

   const isEdit = computed(() => !!props.eventId)
   const submitting = ref(false)
   const error = ref('')

   // price в major единицах для UI (15.00), backend хранит minor (1500)
   const priceMajor = ref(props.initial ? props.initial.price / 100 : 0)

   const form = ref({
     title: props.initial?.title ?? '',
     type: props.initial?.type ?? 'training',
     startsAt: props.initial?.startsAt ? toLocalInput(props.initial.startsAt) : '',
     endsAt: props.initial?.endsAt ? toLocalInput(props.initial.endsAt) : '',
     venueId: props.initial?.venueId ?? null,
     locationText: props.initial?.locationText ?? '',
     capacity: props.initial?.capacity ?? 12,
     currency: props.initial?.currency ?? 'BYN',
     cancellationDeadlineHours: props.initial?.cancellationDeadlineHours ?? null,
     description: props.initial?.description ?? '',
   })

   await fetchAll()

   async function onSubmit() {
     submitting.value = true
     error.value = ''
     try {
       const payload = {
         ...form.value,
         price: Math.round(priceMajor.value * 100),
         startsAt: new Date(form.value.startsAt).toISOString(),
         endsAt: new Date(form.value.endsAt).toISOString(),
         locationText: form.value.venueId ? undefined : form.value.locationText,
       }
       const event = isEdit.value
         ? await updateEvent(props.eventId!, payload)
         : await createEvent(payload)
       emit('saved', event)
     } catch (e: any) {
       error.value = errorMessage(e?.data?.code, 'Не удалось сохранить событие')
     } finally {
       submitting.value = false
     }
   }

   function toLocalInput(iso: string): string {
     const d = new Date(iso)
     const off = d.getTimezoneOffset()
     return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
   }
   </script>
   ```

4. **Страницы:**
   - `pages/m/orgs/[orgId]/events/new.vue` — Mini App, использует EventForm, после saved → redirect на событие
   - `pages/m/orgs/[orgId]/events/[eventId]/edit.vue` — Mini App, загружает initial, EventForm
   - `pages/orgs/[orgId]/events/new.vue` — Web (layout default), тот же EventForm
   - Все с `requireCanManageContent` проверкой (через middleware или редирект если member.role player)

5. **Venues management `pages/m/orgs/[orgId]/venues/index.vue`:**
   - Список venues, кнопка «+ Площадка» → sheet с формой (name, address, capacityHint, notes)
   - Edit/archive каждой
   - Паттерн как invites manager (4.7.4)

## Критерии приёмки

- ✅ EventForm: title, type, start/end (datetime-local), venue select или текст, capacity, price (major→minor конверсия), deadline, description
- ✅ Venue select: «указать вручную» → текстовое поле; иначе выбор из списка
- ✅ Цена вводится в рублях/BYN (15.00), сохраняется в minor (1500)
- ✅ datetime-local конвертируется в ISO с учётом таймзоны
- ✅ Create → событие создано, redirect
- ✅ Edit → загружает initial, сохраняет изменения
- ✅ Web-версия create работает (тот же компонент, layout default)
- ✅ Venues CRUD через sheet
- ✅ Только owner/organizer (player → нет доступа)
- ✅ Ошибки переведены (capacity_below_confirmed при edit)

## Подсказки

- **price major/minor:** UI показывает 15.00, backend 1500. Конверсия в onSubmit (×100, Math.round) и при загрузке (/100).
- **datetime-local таймзона:** input даёт локальное время без зоны. toLocalInput компенсирует offset для корректного отображения, new Date().toISOString() при сохранении.
- **EventForm переиспользуется** create/edit и Mini App/Web — один компонент, разные обёртки-страницы.
- **venueId vs locationText:** если выбран venue — locationText не отправляем (backend возьмёт из venue или оставит null). Если вручную — locationText.

## Не делать

- ❌ Не делать recurring — Phase 15
- ❌ Не делать загрузку фото события — Phase 14+
- ❌ Не делать предпросмотр — лишнее
- ❌ Не делать draft-сохранение (создаём сразу published)
