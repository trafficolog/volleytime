---
id: '4.7.2'
phase: '4'
epic: '4.7'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - FE
depends_on:
  - '4.7.1'
estimated_hours: '1-2'
tags:
  - ui
  - nuxt
  - forms
---

# Task 4.7.2: Форма создания организации

## Цель

Страница `/m/orgs/new` (и `/orgs/new` для web) — форма создания организации. Поля: name (required), city (optional), description (optional), default_member_status.

## Контекст

Форма создания — первый «активный» экран после empty state. Дизайн опирается на https://volleytime.trafficolog.ru/ (Mini App). После создания — переход на dashboard новой org.

## Что должно быть сделано

1. **`apps/web/pages/m/orgs/new.vue`:**

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <button type="button" @click="$router.back()" class="text-blue-500">←</button>
           <h1 class="text-lg font-semibold">Создать организацию</h1>
         </header>

         <main class="px-4 py-6 max-w-md mx-auto">
           <form @submit.prevent="onSubmit" class="space-y-4">
             <div>
               <label class="block text-sm font-medium mb-1">Название *</label>
               <input
                 v-model="form.name"
                 type="text"
                 required
                 minlength="2"
                 maxlength="100"
                 class="w-full border rounded-lg px-3 py-2"
                 :disabled="loading"
                 placeholder="Например: Volley Minsk Evening"
               />
             </div>

             <div>
               <label class="block text-sm font-medium mb-1">Город</label>
               <input
                 v-model="form.city"
                 type="text"
                 maxlength="100"
                 class="w-full border rounded-lg px-3 py-2"
                 :disabled="loading"
                 placeholder="Например: Минск"
               />
             </div>

             <div>
               <label class="block text-sm font-medium mb-1">Описание</label>
               <textarea
                 v-model="form.description"
                 maxlength="500"
                 rows="3"
                 class="w-full border rounded-lg px-3 py-2"
                 :disabled="loading"
                 placeholder="Несколько слов о вашей группе"
               />
             </div>

             <div>
               <label class="block text-sm font-medium mb-1"> Приём новых участников </label>
               <div class="space-y-2">
                 <label class="flex items-start gap-2 cursor-pointer">
                   <input
                     v-model="form.defaultMemberStatus"
                     type="radio"
                     value="active"
                     :disabled="loading"
                   />
                   <div>
                     <div class="font-medium">Сразу принимать</div>
                     <div class="text-xs text-gray-500">Перешёл по ссылке — сразу участник</div>
                   </div>
                 </label>
                 <label class="flex items-start gap-2 cursor-pointer">
                   <input
                     v-model="form.defaultMemberStatus"
                     type="radio"
                     value="pending"
                     :disabled="loading"
                   />
                   <div>
                     <div class="font-medium">С подтверждением</div>
                     <div class="text-xs text-gray-500">Каждую заявку нужно одобрить вручную</div>
                   </div>
                 </label>
               </div>
             </div>

             <div v-if="error" class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
               {{ error }}
             </div>

             <button
               type="submit"
               class="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
               :disabled="loading || !form.name"
             >
               {{ loading ? 'Создание…' : 'Создать организацию' }}
             </button>
           </form>
         </main>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const { fetchAll, setCurrentOrg } = useOrganizations()
   const router = useRouter()

   const form = ref({
     name: '',
     city: '',
     description: '',
     defaultMemberStatus: 'active' as 'active' | 'pending',
   })
   const loading = ref(false)
   const error = ref('')

   async function onSubmit() {
     loading.value = true
     error.value = ''
     try {
       const data = await $fetch<{ organization: { id: number } }>('/api/organizations', {
         method: 'POST',
         body: {
           name: form.value.name,
           city: form.value.city || undefined,
           description: form.value.description || undefined,
           defaultMemberStatus: form.value.defaultMemberStatus,
         },
       })
       await fetchAll()
       setCurrentOrg(data.organization.id)
       router.push(`/m/orgs/${data.organization.id}`)
     } catch (e: any) {
       const data = e?.data
       if (data?.errors) {
         error.value = 'Проверь поля формы'
       } else {
         error.value = data?.statusMessage ?? e?.statusMessage ?? 'Не удалось создать организацию'
       }
     } finally {
       loading.value = false
     }
   }
   </script>
   ```

2. **Аналогичная страница `/orgs/new.vue` для веб** — то же содержимое с другим layout (default).

3. **Smoke test** (`apps/web/pages/m/orgs/__tests__/new.test.ts`):
   ```ts
   // Vue Test Utils не настроен в Phase 3 — отложим до Phase 9
   // В Phase 4 — manual testing через Mini App
   ```

## Критерии приёмки

- ✅ Поле name обязательно (HTML required + minlength=2, maxlength=100)
- ✅ Поля city, description опциональны
- ✅ Radio для defaultMemberStatus — `active` (default) или `pending`
- ✅ Submit отправляет POST на `/api/organizations`
- ✅ При успехе:
  - fetchAll() обновляет state
  - setCurrentOrg() устанавливает новую org как current
  - редирект на `/m/orgs/[id]`
- ✅ При ошибке — показывается понятное сообщение
- ✅ Кнопка disabled пока loading или name пуст
- ✅ Mobile-first, blue primary

## Подсказки

- **Slug автогенерируется** на бэкенде (4.1.4) — UI про него ничего не знает. Если потребуется UX «предпросмотр slug» — можно сделать live preview позже.
- **Disabled state**: используй `loading` ref для всех inputs, чтобы во время submit нельзя было кликать дважды.
- **Validation errors из 422:** API возвращает `data.errors` (Zod array). В Phase 4 показываем generic "проверь поля", в Phase 9+ можно сделать field-level errors.

## Не делать

- ❌ Не делать avatar upload — Phase 14+
- ❌ Не делать sport_type выбор — пока только volleyball
- ❌ Не делать live slug preview
- ❌ Не делать `/m/orgs/new?invite=true` flow — invite acceptance это другой path
