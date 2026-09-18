---
id: '7.4.2'
phase: '7'
epic: '7.4'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
depends_on:
  - '7.4.1'
estimated_hours: '1-2'
tags:
  - credits
  - pricing
  - admin
---

# Task 7.4.2: Pricing service (CRUD тарифов, валидация, подсказки)

## Цель

Сервис управления тарифной сеткой (для root-admin 7.7): просмотр, редактирование порогов/цен, валидация (пороги возрастают, цены положительные). API для расчёта (organizer 7.6).

## Контекст

Решение 4: root-admin редактирует сетку (для экспериментов с ценой тоже). Валидация защищает от невалидной сетки (пересекающиеся пороги, отрицательные цены).

## Что должно быть сделано

1. **pricingService `modules/credits/pricing.ts` (расширение):**

   ```ts
   export const pricingService = {
     async listTiers() {
       return db.query.creditPricingTiers.findMany({
         orderBy: (t, { asc }) => [asc(t.minQuantity)],
       })
     },

     /**
      * Заменить всю сетку (проще чем CRUD отдельных). Валидация.
      * Root-admin задаёт массив порогов целиком.
      */
     async replaceTiers(
       ctx: ServiceContext,
       tiers: { minQuantity: number; pricePerCredit: number }[],
     ) {
       // валидация
       if (tiers.length === 0)
         throw new CreditError('credits.empty_pricing', 'Сетка не может быть пустой')
       const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity)
       if (sorted[0].minQuantity !== 1) {
         throw new CreditError(
           'credits.pricing_must_start_at_1',
           'Сетка должна начинаться с количества 1',
         )
       }
       for (let i = 0; i < sorted.length; i++) {
         if (sorted[i].minQuantity < 1 || sorted[i].pricePerCredit < 1) {
           throw new CreditError('credits.invalid_tier', 'Пороги и цены должны быть положительными')
         }
         if (i > 0 && sorted[i].minQuantity === sorted[i - 1].minQuantity) {
           throw new CreditError('credits.duplicate_threshold', 'Дублирующиеся пороги')
         }
       }

       // заменить (деактивировать старые, вставить новые) — в транзакции
       return await db.transaction(async (tx) => {
         await tx.update(creditPricingTiers).set({ active: false })
         await tx.insert(creditPricingTiers).values(sorted.map((t) => ({ ...t, active: true })))
       })
     },

     calculatePrice, // из 7.4.1
     getSuggestedQuantities, // из 7.4.1
   }
   ```

2. **API quote endpoint (для organizer 7.6)** `server/api/organizations/[orgId]/credits/quote.get.ts`:

   ```ts
   // ?quantity=35 → { quantity, pricePerCredit, total, tierMinQuantity }
   export default defineEventHandler(async (event) => {
     requireCanManageContent(event.context.member) // организатор
     const quantity = Number(getQuery(event).quantity)
     return calculatePrice(quantity)
   })
   ```

3. **Валидация сетки:**
   - Начинается с minQuantity=1 (иначе малые количества без цены)
   - Пороги уникальны, возрастают
   - Цены положительные
   - Не пустая

4. **replaceTiers vs CRUD:** замена всей сетки целиком проще управления отдельными строками (root-admin видит всю сетку, правит, сохраняет). Активные = текущая сетка, старые деактивируются (история изменений цен).

5. **Тесты:**
   ```ts
   test('listTiers returns active tiers sorted', async () => {})
   test('replaceTiers valid grid', async () => {})
   test('replaceTiers must start at 1', async () => {})
   test('replaceTiers rejects negative price', async () => {})
   test('replaceTiers rejects duplicate thresholds', async () => {})
   test('quote endpoint returns price for quantity', async () => {})
   ```

## Критерии приёмки

- ✅ listTiers (активные, сортированы)
- ✅ replaceTiers (замена сетки целиком, валидация)
- ✅ Валидация: начало с 1, положительные, уникальные пороги, не пустая
- ✅ Старые тарифы деактивируются (история цен)
- ✅ API quote (organizer: quantity → цена)
- ✅ Тесты валидации

## Подсказки

- **replaceTiers целиком** проще чем CRUD строк — root-admin видит сетку, правит как массив, сохраняет. Атомарная замена (деактивировать + вставить).
- **Деактивация, не удаление** — история изменений цен (audit, какая сетка была когда). active=true = текущая.
- **Начало с 1 обязательно** — иначе Q=1..9 без применимого tier (no_pricing). Валидация enforces.
- **quote endpoint** — organizer вводит количество, фронт (7.6) показывает сумму в реальном времени.

## Не делать

- ❌ Не допускать сетку без minQuantity=1
- ❌ Не удалять старые тарифы (деактивация — история)
- ❌ Не давать organizer менять сетку (только root-admin 7.7)
