---
id: '10.2.2'
phase: '10'
epic: '10.2'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - FE
depends_on:
  - '10.2.1'
estimated_hours: '1'
tags:
  - beta
  - feedback
  - ui
---

# Task 10.2.2: UI кнопка/форма обратной связи в Mini App

## Цель

Кнопка «Обратная связь» в Mini App (в меню/настройках), форма (текст), отправка с контекстом текущего экрана.

## Контекст

Решение 4: быстрый репорт из контекста. Кнопка доступна глобально (меню Mini App), форма простая, передаёт текущий экран автоматически.

## Что должно быть сделано

1. **Composable `useFeedback.ts`:**

   ```ts
   export function useFeedback() {
     const route = useRoute()
     async function send(text: string, orgId?: number) {
       return $fetch('/api/feedback', {
         method: 'POST',
         body: { text, context: { screen: route.path, orgId } },
       })
     }
     return { send }
   }
   ```

2. **Компонент `FeedbackSheet.vue`** (sheet снизу, паттерн Phase 5):

   ```vue
   <template>
     <div class="fixed inset-0 bg-black/50 z-40 flex items-end" @click="$emit('close')">
       <div class="bg-white rounded-t-2xl w-full max-w-md p-6" @click.stop>
         <h2 class="text-lg font-semibold mb-1">Обратная связь</h2>
         <p class="text-sm text-gray-500 mb-4">Нашли проблему или есть идея? Напишите нам.</p>
         <textarea
           v-model="text"
           rows="4"
           maxlength="2000"
           class="w-full border rounded-lg px-3 py-2 mb-3"
           placeholder="Опишите проблему или предложение…"
         ></textarea>
         <div class="flex gap-2">
           <button type="button" class="flex-1 border py-2.5 rounded-lg" @click="$emit('close')">
             Отмена
           </button>
           <button
             type="button"
             class="flex-1 bg-blue-500 text-white py-2.5 rounded-lg disabled:opacity-50"
             :disabled="!text.trim() || sending"
             @click="onSend"
           >
             {{ sending ? 'Отправка…' : 'Отправить' }}
           </button>
         </div>
         <p v-if="sent" class="mt-3 text-sm text-green-600 text-center">
           Спасибо! Сообщение отправлено.
         </p>
       </div>
     </div>
   </template>

   <script setup lang="ts">
   const props = defineProps<{ orgId?: number }>()
   const emit = defineEmits<{ close: [] }>()
   const { send } = useFeedback()
   const { haptic } = useTelegram()

   const text = ref('')
   const sending = ref(false)
   const sent = ref(false)

   async function onSend() {
     sending.value = true
     try {
       await send(text.value, props.orgId)
       sent.value = true
       haptic('success')
       setTimeout(() => emit('close'), 1500)
     } finally {
       sending.value = false
     }
   }
   </script>
   ```

3. **Точка входа** — кнопка в меню Mini App (layout miniapp или dashboard):

   ```vue
   <button
     type="button"
     @click="showFeedback = true"
     class="flex items-center gap-2 text-sm text-gray-500"
   >
     💬 Обратная связь
   </button>
   <FeedbackSheet v-if="showFeedback" :org-id="currentOrgId" @close="showFeedback = false" />
   ```

   Разместить в доступном месте (меню/настройки/футер dashboard).

4. **Контекст экрана** — route.path передаётся автоматически (useFeedback), не требует ручного ввода.

## Критерии приёмки

- ✅ useFeedback composable (send с контекстом route)
- ✅ FeedbackSheet (текст, отправка, подтверждение)
- ✅ Кнопка «Обратная связь» в доступном месте Mini App
- ✅ Текущий экран передаётся автоматически
- ✅ Haptic success при отправке
- ✅ Подтверждение пользователю
- ✅ Авто-закрытие после успеха

## Подсказки

- **Sheet снизу** — паттерн Phase 5 (BookingSheet и т.д.), единообразно.
- **route.path автоматически** — пользователь не указывает экран, передаётся сам. Триаж проще.
- **haptic success** (Phase 8) — тактильное подтверждение.
- **Размещение кнопки** — в меню/настройках или футере dashboard. Не навязчиво, но findable.

## Не делать

- ❌ Не делать обязательные поля кроме текста
- ❌ Не блокировать UI при отправке надолго
- ❌ Не требовать категорию/severity от пользователя (триаж — наша работа)
