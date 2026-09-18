---
id: '6.6.2'
phase: '6'
epic: '6.6'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 6.8 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - FE
depends_on:
  - '6.6.1'
estimated_hours: '1-2'
tags:
  - ui
  - ledger
  - cashbox
---

# Task 6.6.2: Добавление расхода (sheet) + категории labels

## Цель

Компонент `LedgerExpenseSheet` — sheet добавления расхода (категория, сумма, описание). Фильтр истории по типу/категории (опционально).

## Контекст

Организатор вводит расходы: аренда, мячи, оплата тренеру. Только expense-категории (income создаётся автоматически через payment).

## Что должно быть сделано

1. **Компонент `apps/web/components/LedgerExpenseSheet.vue`:**

   ```vue
   <template>
     <div
       class="fixed inset-0 bg-black/50 z-30 flex items-end justify-center"
       @click="$emit('close')"
     >
       <div class="bg-white rounded-t-2xl w-full max-w-md p-6" @click.stop>
         <h2 class="text-lg font-semibold mb-4">Добавить расход</h2>
         <form @submit.prevent="onSubmit" class="space-y-4">
           <div>
             <label class="block text-sm font-medium mb-1">Категория</label>
             <select v-model="form.category" class="w-full border rounded-lg px-3 py-2">
               <option value="rent">Аренда зала</option>
               <option value="equipment">Инвентарь</option>
               <option value="salary">Оплата тренеру</option>
               <option value="other">Прочее</option>
             </select>
           </div>
           <div>
             <label class="block text-sm font-medium mb-1">Сумма (BYN)</label>
             <input
               v-model.number="amountMajor"
               type="number"
               required
               min="0.01"
               step="0.01"
               class="w-full border rounded-lg px-3 py-2"
               placeholder="50.00"
             />
           </div>
           <div>
             <label class="block text-sm font-medium mb-1">Описание</label>
             <input
               v-model="form.description"
               type="text"
               maxlength="500"
               class="w-full border rounded-lg px-3 py-2"
               placeholder="Аренда зала за март"
             />
           </div>
           <div v-if="error" class="text-sm text-red-600">{{ error }}</div>
           <div class="flex gap-2">
             <button type="button" class="flex-1 border py-2.5 rounded-lg" @click="$emit('close')">
               Отмена
             </button>
             <button
               type="submit"
               class="flex-1 bg-blue-500 text-white py-2.5 rounded-lg disabled:opacity-50"
               :disabled="submitting || !amountMajor"
             >
               {{ submitting ? 'Сохранение…' : 'Добавить' }}
             </button>
           </div>
         </form>
       </div>
     </div>
   </template>

   <script setup lang="ts">
   import { errorMessage } from '~/utils/labels'

   const props = defineProps<{ orgId: number }>()
   const emit = defineEmits<{ close: []; added: [] }>()

   const { addExpense } = useLedger(props.orgId)

   const form = ref({
     category: 'rent' as 'rent' | 'equipment' | 'salary' | 'other',
     description: '',
   })
   const amountMajor = ref<number | null>(null)
   const submitting = ref(false)
   const error = ref('')

   async function onSubmit() {
     if (!amountMajor.value) return
     submitting.value = true
     error.value = ''
     try {
       await addExpense({
         category: form.value.category,
         amount: Math.round(amountMajor.value * 100),
         description: form.value.description || undefined,
       })
       emit('added')
     } catch (e: any) {
       error.value = errorMessage(e?.data?.code, 'Не удалось добавить расход')
     } finally {
       submitting.value = false
     }
   }
   </script>
   ```

2. **Фильтр истории (опционально)** в cashbox — табы income/expense/all:

   ```vue
   <!-- в cashbox/index.vue над историей -->
   <div class="flex gap-2 mb-3">
     <button v-for="f in filters" :key="f.value" type="button"
       class="px-3 py-1 text-xs rounded-full border"
       :class="activeFilter === f.value ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200'"
       @click="setFilter(f.value)">{{ f.label }}</button>
   </div>
   ```

   ```ts
   const filters = [
     { value: undefined, label: 'Все' },
     { value: 'income', label: 'Доходы' },
     { value: 'expense', label: 'Расходы' },
   ]
   const activeFilter = ref<string | undefined>(undefined)
   function setFilter(type?: string) {
     activeFilter.value = type
     fetch(type ? { type } : {})
   }
   ```

3. **Dashboard плитка «Касса»** (`/m/orgs/[orgId]/index.vue`):
   ```vue
   <NuxtLink
     v-if="canManage"
     :to="`/m/orgs/${org.id}/cashbox`"
     class="bg-white border rounded-lg p-4 hover:border-blue-300"
   >
     <div class="text-2xl mb-1">💰</div>
     <div class="font-medium">Касса</div>
   </NuxtLink>
   ```

## Критерии приёмки

- ✅ LedgerExpenseSheet: категория (rent/equipment/salary/other), сумма (major→minor), описание
- ✅ Только expense-категории (не payment_income/refund)
- ✅ amount конверсия major→minor (50.00 → 5000)
- ✅ Валидация: сумма > 0
- ✅ После добавления → emit added, касса обновляется
- ✅ Фильтр истории income/expense/all (опционально)
- ✅ Плитка «Касса» в dashboard (owner/organizer)
- ✅ Ошибки переведены

## Подсказки

- **Только 4 категории расходов** в UI — payment_income и refund создаются системой автоматически, вручную недоступны (бэкенд 6.2.2 это enforced).
- **amount major→minor** — как в EventForm/PlanForm (×100).
- **Фильтр через повторный fetch** с query — backend listHistory поддерживает (6.2.2).

## Не делать

- ❌ Не позволять ручной income (только через payment confirm)
- ❌ Не делать редактирование
- ❌ Не делать загрузку чеков/фото — Phase 14+
