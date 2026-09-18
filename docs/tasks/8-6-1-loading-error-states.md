---
id: '8.6.1'
phase: '8'
epic: '8.6'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11."
roles:
  - FE
depends_on:
  - '8.2.3'
estimated_hours: '1-2'
tags:
  - ui
  - ux
  - mini-app
---

# Task 8.6.1: Loading skeletons + error states унификация

## Цель

Единообразные loading skeletons (вместо голых спиннеров) на ключевых экранах. Error states с retry. Переиспользуемые компоненты.

## Контекст

Phase 5-6 экраны используют простые спиннеры. Для релизного качества — skeletons (контур контента) на списках, единые error-состояния с retry. Skeletons ощущаются быстрее спиннера.

## Что должно быть сделано

1. **Компонент `apps/web/components/SkeletonList.vue`** — заглушка списка:

   ```vue
   <template>
     <div class="space-y-3">
       <div v-for="i in count" :key="i" class="bg-white border rounded-lg p-4 animate-pulse">
         <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
         <div class="h-3 bg-gray-100 rounded w-1/2 mb-3"></div>
         <div class="h-1.5 bg-gray-100 rounded-full"></div>
       </div>
     </div>
   </template>
   <script setup lang="ts">
   withDefaults(defineProps<{ count?: number }>(), { count: 3 })
   </script>
   ```

2. **Компонент `apps/web/components/ErrorState.vue`** — ошибка с retry:

   ```vue
   <template>
     <div class="text-center py-12">
       <div class="text-4xl mb-3">⚠️</div>
       <p class="text-gray-700 mb-1">{{ title }}</p>
       <p class="text-sm text-gray-500 mb-4">{{ message }}</p>
       <button
         v-if="onRetry"
         type="button"
         class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
         @click="onRetry"
       >
         Повторить
       </button>
     </div>
   </template>
   <script setup lang="ts">
   withDefaults(defineProps<{ title?: string; message?: string; onRetry?: () => void }>(), {
     title: 'Не удалось загрузить',
     message: 'Проверьте соединение и попробуйте снова',
   })
   </script>
   ```

3. **Composable `apps/web/composables/useAsyncData2.ts`** (или расширить существующие fetch-обёртки) — единый loading/error/data:

   ```ts
   export function useAsyncResource<T>(fetcher: () => Promise<T>) {
     const data = ref<T | null>(null)
     const loading = ref(false)
     const error = ref<unknown>(null)

     async function load() {
       loading.value = true
       error.value = null
       try {
         data.value = await fetcher()
       } catch (e) {
         error.value = e
       } finally {
         loading.value = false
       }
     }
     return { data, loading, error, load, retry: load }
   }
   ```

4. **Применить на ключевых экранах:**
   - Список событий (5.9.1): skeleton при loading, ErrorState при ошибке + retry
   - Мои записи (5.9.4): skeleton + error
   - Касса (6.6.1): skeleton для истории
   - Pending payments (6.5.1): skeleton + error

   Пример (список событий):

   ```vue
   <SkeletonList v-if="loading" :count="4" />
   <ErrorState v-else-if="error" :on-retry="() => fetchList(filter)" />
   <EmptyState v-else-if="events.length === 0" ... />
   <ul v-else> ... </ul>
   ```

5. **EmptyState компонент** (унифицировать существующие empty states):
   ```vue
   <template>
     <div class="text-center py-12 text-gray-500">
       <div v-if="icon" class="text-4xl mb-3">{{ icon }}</div>
       <p>{{ message }}</p>
       <slot name="action" />
     </div>
   </template>
   ```

## Критерии приёмки

- ✅ SkeletonList компонент (animate-pulse, контур карточки)
- ✅ ErrorState компонент с retry-кнопкой
- ✅ EmptyState унифицирован
- ✅ Ключевые списки (события, мои записи, касса, оплаты): skeleton при loading
- ✅ Ошибка API → ErrorState с retry (не белый экран, не зависший спиннер)
- ✅ Retry повторяет запрос
- ✅ Единый паттерн (loading→skeleton, error→ErrorState, empty→EmptyState, data→list)

## Подсказки

- **Skeleton > спиннер** — контур контента ощущается быстрее, меньше «прыжков» layout при загрузке.
- **ErrorState с retry критичен** — мобильная сеть нестабильна, сбой запроса не должен оставлять белый экран. Retry даёт выход.
- **useAsyncResource** опционально — если существующие composables (useEvents и т.д.) уже дают loading, можно добавить error в них, а не вводить новый. Прагматично.
- **animate-pulse** — Tailwind встроенный, без доп. CSS.

## Не делать

- ❌ Не делать skeleton для каждого мелкого элемента (только списки/ключевое)
- ❌ Не делать сложные анимации загрузки
- ❌ Не переписывать все экраны (ключевые)
