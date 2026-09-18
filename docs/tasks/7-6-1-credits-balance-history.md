---
id: '7.6.1'
phase: '7'
epic: '7.6'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - FE
depends_on:
  - '7.1.2'
estimated_hours: '1-2'
tags:
  - credits
  - ui
  - mini-app
---

# Task 7.6.1: useCredits composable + баланс + история

## Цель

Composable useCredits + страница credits в Mini App: баланс (крупно), история транзакций (grant/spend/refund/purchase) с русскими названиями.

## Контекст

Решение 9: прозрачность. Организатор видит баланс и куда тратятся credits. Переиспускает паттерны Phase 5-6 UI (composables, labels, formatters).

## Что должно быть сделано

1. **API** `server/api/organizations/[orgId]/credits/index.get.ts`:

   ```ts
   export default defineEventHandler(async (event) => {
     requireCanManageContent(event.context.member)
     const ctx = createServiceContextFromEvent(event)
     const orgId = event.context.organization!.id
     const [balance, transactions] = await Promise.all([
       creditService.getBalance(ctx, orgId),
       creditService.listTransactions(ctx, orgId, 50),
     ])
     return { balance, transactions }
   })
   ```

2. **Composable `useCredits.ts`:**

   ```ts
   export function useCredits(orgId: Ref<number> | number) {
     const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
     const balance = ref(0)
     const transactions = ref<any[]>([])
     const loading = ref(false)

     async function fetch() {
       loading.value = true
       try {
         const data = await $fetch<any>(`/api/organizations/${orgIdRef.value}/credits`)
         balance.value = data.balance
         transactions.value = data.transactions
       } finally {
         loading.value = false
       }
     }
     async function quote(quantity: number) {
       return $fetch<any>(`/api/organizations/${orgIdRef.value}/credits/quote`, {
         query: { quantity },
       })
     }
     async function requestPurchase(quantity: number) {
       return $fetch(`/api/organizations/${orgIdRef.value}/credits/purchase`, {
         method: 'POST',
         body: { quantity },
       })
     }
     return { balance, transactions, loading, fetch, quote, requestPurchase }
   }
   ```

3. **Labels** (расширить utils/labels.ts):

   ```ts
   export const CREDIT_TX_TYPE_LABELS: Record<string, string> = {
     demo_grant: 'Демо-квота',
     admin_grant: 'Начислено администратором',
     purchase: 'Покупка',
     spend: 'Создание события',
     refund: 'Возврат (отмена события)',
   }
   ```

4. **Страница `pages/m/orgs/[orgId]/credits/index.vue`:**
   ```vue
   <!-- баланс крупно (N credits), кнопка "Купить" -->
   <!-- история: тип (русский), ± количество, дата, баланс после -->
   <!-- spend красным (−1), grant/purchase/refund зелёным (+N) -->
   ```
   Паттерн как касса (6.6.1).

## Критерии приёмки

- ✅ API credits (баланс + история, owner/organizer)
- ✅ useCredits: fetch, quote, requestPurchase
- ✅ Баланс крупно
- ✅ История: тип (русский), ±количество, дата, баланс после
- ✅ CREDIT_TX_TYPE_LABELS в shared labels
- ✅ spend/grant визуально различимы (цвет, знак)
- ✅ Кнопка «Купить» (→ 7.6.2)
- ✅ Только owner/organizer

## Подсказки

- **Как касса (6.6.1)** — баланс + лента операций, единообразно. Credits вместо денег.
- **balanceAfter в истории** — видно как менялся баланс (audit-прозрачность).
- **Типы на русском** через shared labels — единый источник.
- **Не показывать игрокам** — credits это для организаторов (платят за создание событий).

## Не делать

- ❌ Не показывать credits игрокам
- ❌ Не делать графики
- ❌ Не делать покупку здесь (7.6.2)
