---
id: '6.6.1'
phase: '6'
epic: '6.6'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - FE
depends_on:
  - '6.2.3'
estimated_hours: '2'
tags:
  - ui
  - ledger
  - cashbox
---

# Task 6.6.1: useLedger composable + баланс + история

## Цель

Composable `useLedger` + страница `/m/orgs/:orgId/cashbox` — баланс (крупно) и история операций (income/expense с категориями, датами).

## Контекст

Касса — финансовая картина организации. Организатор видит сколько собрано/потрачено. Переиспользует useFormatters, labels для категорий.

## Что должно быть сделано

1. **Composable `apps/web/composables/useLedger.ts`:**

   ```ts
   export function useLedger(orgId: Ref<number> | number) {
     const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
     const balance = ref<{ income: number; expense: number; balance: number }>({
       income: 0,
       expense: 0,
       balance: 0,
     })
     const entries = ref<any[]>([])
     const loading = ref(false)

     async function fetch(query: Record<string, any> = {}) {
       loading.value = true
       try {
         const data = await $fetch<any>(`/api/organizations/${orgIdRef.value}/ledger`, { query })
         balance.value = data.balance
         entries.value = data.entries
       } finally {
         loading.value = false
       }
     }
     async function addExpense(input: { category: string; amount: number; description?: string }) {
       await $fetch(`/api/organizations/${orgIdRef.value}/ledger/expense`, {
         method: 'POST',
         body: input,
       })
       await fetch()
     }
     return { balance, entries, loading, fetch, addExpense }
   }
   ```

2. **Категории labels** — добавить в `utils/labels.ts`:

   ```ts
   export const LEDGER_CATEGORY_LABELS: Record<string, string> = {
     payment_income: 'Оплата участника',
     rent: 'Аренда зала',
     equipment: 'Инвентарь',
     refund: 'Возврат',
     salary: 'Оплата тренеру',
     other: 'Прочее',
   }
   ```

3. **Страница `pages/m/orgs/[orgId]/cashbox/index.vue`:**
   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header
           class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center justify-between"
         >
           <div class="flex items-center gap-3">
             <NuxtLink :to="`/m/orgs/${orgId}`" class="text-blue-500">←</NuxtLink>
             <h1 class="text-lg font-semibold">Касса</h1>
           </div>
           <button
             type="button"
             class="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm"
             @click="showExpense = true"
           >
             + Расход
           </button>
         </header>

         <main class="px-4 py-4">
           <!-- Баланс -->
           <div class="bg-white border rounded-lg p-5 mb-4 text-center">
             <div class="text-sm text-gray-500 mb-1">Баланс</div>
             <div
               class="text-3xl font-bold"
               :class="balance.balance >= 0 ? 'text-gray-900' : 'text-red-600'"
             >
               {{ formatPrice(balance.balance, 'BYN') }}
             </div>
             <div class="flex justify-center gap-6 mt-3 text-sm">
               <div>
                 <span class="text-green-600">↑ {{ formatPrice(balance.income, 'BYN') }}</span>
                 <div class="text-xs text-gray-400">доход</div>
               </div>
               <div>
                 <span class="text-red-500">↓ {{ formatPrice(balance.expense, 'BYN') }}</span>
                 <div class="text-xs text-gray-400">расход</div>
               </div>
             </div>
           </div>

           <!-- История -->
           <h2 class="text-sm font-semibold text-gray-500 uppercase mb-2">История</h2>
           <div v-if="loading" class="py-8 flex justify-center">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
           </div>
           <div v-else-if="entries.length === 0" class="text-center py-8 text-gray-500">
             Операций пока нет
           </div>
           <ul v-else class="space-y-2">
             <li
               v-for="e in entries"
               :key="e.id"
               class="bg-white border rounded-lg p-3 flex items-center justify-between"
             >
               <div>
                 <div class="font-medium text-sm">{{ categoryLabel(e.category) }}</div>
                 <div v-if="e.description" class="text-xs text-gray-500">{{ e.description }}</div>
                 <div class="text-xs text-gray-400">{{ formatDateTime(e.createdAt) }}</div>
               </div>
               <div
                 class="font-semibold"
                 :class="e.type === 'income' ? 'text-green-600' : 'text-red-500'"
               >
                 {{ e.type === 'income' ? '+' : '−' }}{{ formatPrice(e.amount, e.currency) }}
               </div>
             </li>
           </ul>
         </main>

         <!-- Expense sheet (6.6.2) -->
         <LedgerExpenseSheet
           v-if="showExpense"
           :org-id="orgId"
           @close="showExpense = false"
           @added="onExpenseAdded"
         />
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })
   import { LEDGER_CATEGORY_LABELS, label } from '~/utils/labels'

   const route = useRoute()
   const orgId = computed(() => Number(route.params.orgId))
   const { balance, entries, loading, fetch } = useLedger(orgId)
   const { formatPrice, formatDateTime } = useFormatters()

   const showExpense = ref(false)

   await fetch()

   function categoryLabel(c: string) {
     return label(LEDGER_CATEGORY_LABELS, c)
   }
   async function onExpenseAdded() {
     showExpense.value = false
     await fetch()
   }
   </script>
   ```

## Критерии приёмки

- ✅ useLedger: fetch (баланс+история), addExpense
- ✅ Баланс крупно, красный если отрицательный
- ✅ Доход/расход разбивка под балансом
- ✅ История: категория (русский), описание, дата, сумма (+зелёный/−красный)
- ✅ LEDGER_CATEGORY_LABELS в shared labels
- ✅ Empty/loading states
- ✅ Кнопка «+ Расход» открывает sheet (6.6.2)
- ✅ Только owner/organizer (canManageContent на API)

## Подсказки

- **Баланс отрицательный** (расходы > доходы) — красным, сигнал организатору.
- **+/− и цвета** — мгновенно читается income vs expense.
- **categoryLabel из shared** — единый источник переводов (расширили labels.ts).
- **LedgerExpenseSheet** — отдельный компонент (6.6.2).

## Не делать

- ❌ Не делать графики — Phase 14
- ❌ Не делать экспорт — Phase 14
- ❌ Не делать редактирование записей (append-only)
- ❌ Не показывать кассу игрокам
