---
id: '7.6.2'
phase: '7'
epic: '7.6'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - FE
depends_on:
  - '7.6.1'
  - '7.4.2'
  - '7.3.1'
estimated_hours: '1-2'
tags:
  - credits
  - ui
  - purchase
---

# Task 7.6.2: Покупка (количество, авто-сумма, заявка) + блок при 0

## Цель

UI покупки credits: ввод произвольного количества (или подсказка 10/30/100) → авто-сумма по сетке (quote) → заявка. Блок создания Event при 0 → сообщение + переход к покупке.

## Контекст

Решение 4 (вариант C): произвольное количество, авто-расчёт. Решение 3: блок при 0 ведёт сюда. Решение 9: прозрачность.

## Что должно быть сделано

1. **Sheet покупки `CreditPurchaseSheet.vue`:**

   ```vue
   <template>
     <div class="fixed inset-0 bg-black/50 z-40 flex items-end" @click="$emit('close')">
       <div class="bg-white rounded-t-2xl w-full max-w-md p-6" @click.stop>
         <h2 class="text-lg font-semibold mb-1">Покупка credits</h2>
         <p class="text-sm text-gray-500 mb-4">
           Credits нужны для создания событий (1 за событие).
         </p>

         <!-- подсказки-пакеты -->
         <div class="flex gap-2 mb-3">
           <button
             v-for="q in suggested"
             :key="q"
             type="button"
             class="flex-1 border rounded-lg py-2 text-sm"
             :class="quantity === q ? 'border-blue-500 bg-blue-50' : 'border-gray-200'"
             @click="setQuantity(q)"
           >
             {{ q }}
           </button>
         </div>

         <!-- произвольное количество -->
         <label class="block text-sm font-medium mb-1">Количество</label>
         <input
           v-model.number="quantity"
           type="number"
           min="1"
           class="w-full border rounded-lg px-3 py-2 mb-3"
           @input="refreshQuote"
         />

         <!-- авто-сумма -->
         <div v-if="priceQuote" class="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
           <div class="flex justify-between">
             <span>Цена за credit</span
             ><span>{{ formatPrice(priceQuote.pricePerCredit, 'BYN') }}</span>
           </div>
           <div class="flex justify-between font-semibold mt-1">
             <span>Итого</span><span>{{ formatPrice(priceQuote.total, 'BYN') }}</span>
           </div>
         </div>

         <button
           type="button"
           class="w-full bg-blue-500 text-white py-2.5 rounded-lg disabled:opacity-50"
           :disabled="!quantity || quantity < 1 || submitting"
           @click="onRequest"
         >
           {{ submitting ? 'Отправка…' : 'Оставить заявку' }}
         </button>
         <p class="text-xs text-gray-400 mt-2 text-center">
           После заявки мы свяжемся для оплаты. Credits начислятся после подтверждения.
         </p>
         <p v-if="sent" class="mt-3 text-sm text-green-600 text-center">
           Заявка отправлена! Мы свяжемся с вами.
         </p>
       </div>
     </div>
   </template>

   <script setup lang="ts">
   const props = defineProps<{ orgId: number }>()
   const emit = defineEmits<{ close: [] }>()
   const { quote, requestPurchase } = useCredits(props.orgId)
   const { formatPrice } = useFormatters()
   const { haptic } = useTelegram()

   const suggested = ref<number[]>([10, 30, 100]) // из API getSuggestedQuantities
   const quantity = ref<number>(10)
   const priceQuote = ref<any>(null)
   const submitting = ref(false)
   const sent = ref(false)

   async function refreshQuote() {
     if (!quantity.value || quantity.value < 1) {
       priceQuote.value = null
       return
     }
     priceQuote.value = await quote(quantity.value)
   }
   function setQuantity(q: number) {
     quantity.value = q
     refreshQuote()
   }

   async function onRequest() {
     submitting.value = true
     try {
       await requestPurchase(quantity.value)
       sent.value = true
       haptic('success')
       setTimeout(() => emit('close'), 2000)
     } finally {
       submitting.value = false
     }
   }

   onMounted(refreshQuote)
   </script>
   ```

2. **Debounce quote** — при вводе количества не дёргать API на каждый символ (debounce 300мс).

3. **Блок создания Event при 0 (связь с 7.3.1):** в EventForm (5.10.1) при ошибке credits.insufficient (402):

   ```ts
   // в обработке ошибки создания события:
   if (error.code === 'credits.insufficient') {
     // показать сообщение + кнопку "Купить credits"
     showCreditsPrompt.value = true // → открыть CreditPurchaseSheet или ведёт на /credits
   }
   ```

4. **Точка входа покупки** — кнопка «Купить» на странице credits (7.6.1) + из блока создания события.

## Критерии приёмки

- ✅ CreditPurchaseSheet: подсказки (10/30/100) + произвольное количество
- ✅ Авто-сумма по сетке (quote, debounced)
- ✅ Цена за credit + итого показаны
- ✅ Заявка (requestPurchase) → подтверждение, haptic
- ✅ Пояснение про ручное подтверждение оплаты
- ✅ Блок создания Event при 0 → сообщение + переход к покупке
- ✅ Только owner/organizer

## Подсказки

- **Произвольное количество (вариант C)** — input number, цена пересчитывается (quote). Подсказки — быстрый выбор, но не ограничение.
- **Debounce quote** — не дёргать API на каждую цифру. 300мс после остановки ввода.
- **Честный текст про подтверждение** — «свяжемся для оплаты, credits после подтверждения» (Phase 7 ручное, не мгновенно). В Phase 12 (bePaid) станет мгновенным.
- **Блок при 0 → покупка** — связь с 7.3.1 (402 insufficient). Не тупик, а путь к решению.

## Не делать

- ❌ Не обещать мгновенное начисление (ручное подтверждение)
- ❌ Не делать online-оплату UI (Phase 12)
- ❌ Не дёргать quote на каждый символ (debounce)
