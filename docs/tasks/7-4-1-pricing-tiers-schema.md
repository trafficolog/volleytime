---
id: '7.4.1'
phase: '7'
epic: '7.4'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: 'Настраиваемая тарифная сетка + flat-tier расчёт.'
roles:
  - BACK
  - DB
depends_on:
  - '7.1.1'
estimated_hours: '2'
tags:
  - credits
  - pricing
  - schema
---

# Task 7.4.1: Schema pricing tiers + calculatePrice + seed

## Цель

Таблица credit_pricing_tiers (порог количества → цена за кредит, настраиваемая). Функция calculatePrice(quantity) — flat-tier расчёт. Seed дефолтной сетки.

## Контекст

Решение 4 (вариант C): root-admin задаёт сетку, покупатель вводит любое количество, цена авто-расчёт. Flat-tier: для Q берётся tier с наибольшим min_quantity ≤ Q, все Q по этой цене.

## Что должно быть сделано

1. **`packages/db/src/schema/credit-pricing-tiers.ts`:**

   ```ts
   import { pgTable, serial, integer, timestamp, boolean } from 'drizzle-orm/pg-core'

   export const creditPricingTiers = pgTable('credit_pricing_tiers', {
     id: serial('id').primaryKey(),
     minQuantity: integer('min_quantity').notNull(), // с какого количества действует
     pricePerCredit: integer('price_per_credit').notNull(), // цена за кредит (minor, напр. 500 = 5.00 BYN)
     active: boolean('active').notNull().default(true),
     updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   })

   export type CreditPricingTier = typeof creditPricingTiers.$inferSelect
   ```

   Платформенная (не per-org) — одна сетка на платформу.

2. **Seed дефолтной сетки** (миграция или seed-скрипт):

   ```ts
   // дефолт (BYN minor):
   { minQuantity: 1,   pricePerCredit: 500 },  // 5.00
   { minQuantity: 10,  pricePerCredit: 400 },  // 4.00
   { minQuantity: 30,  pricePerCredit: 350 },  // 3.50
   { minQuantity: 100, pricePerCredit: 300 },  // 3.00
   ```

3. **calculatePrice — flat-tier `modules/credits/pricing.ts`:**

   ```ts
   import { db, creditPricingTiers } from '@volley-time/db'
   import { eq, lte, desc, and } from 'drizzle-orm'

   export interface PriceQuote {
     quantity: number
     pricePerCredit: number // minor
     total: number // minor
     tierMinQuantity: number
   }

   /**
    * Flat-tier: для quantity берётся активный tier с наибольшим minQuantity ≤ quantity.
    * Все quantity кредитов по цене этого tier.
    */
   export async function calculatePrice(quantity: number): Promise<PriceQuote> {
     if (quantity < 1)
       throw new CreditError('credits.invalid_quantity', 'Количество должно быть ≥ 1')

     const tier = await db.query.creditPricingTiers.findFirst({
       where: and(
         eq(creditPricingTiers.active, true),
         lte(creditPricingTiers.minQuantity, quantity),
       ),
       orderBy: [desc(creditPricingTiers.minQuantity)],
     })
     if (!tier) throw new CreditError('credits.no_pricing', 'Тарифная сетка не настроена')

     return {
       quantity,
       pricePerCredit: tier.pricePerCredit,
       total: quantity * tier.pricePerCredit,
       tierMinQuantity: tier.minQuantity,
     }
   }
   ```

4. **Suggested packages (подсказки)** — из порогов сетки:

   ```ts
   export async function getSuggestedQuantities(): Promise<number[]> {
     const tiers = await db.query.creditPricingTiers.findMany({
       where: eq(creditPricingTiers.active, true),
       orderBy: (t, { asc }) => [asc(t.minQuantity)],
     })
     // пороги как подсказки (10, 30, 100), исключая 1
     return tiers.map((t) => t.minQuantity).filter((q) => q > 1)
   }
   ```

5. **Тесты:**
   ```ts
   test('calculatePrice Q=5 → tier min=1 (5.00), total 25.00', async () => {})
   test('calculatePrice Q=10 → tier min=10 (4.00), total 40.00', async () => {})
   test('calculatePrice Q=35 → tier min=30 (3.50), total 122.50', async () => {})
   test('calculatePrice Q=100 → tier min=100 (3.00), total 300.00', async () => {})
   test('calculatePrice Q=150 → tier min=100, total 450.00', async () => {})
   test('calculatePrice Q=0 → invalid_quantity', async () => {})
   test('boundary: Q=9 vs Q=10 different tiers', async () => {})
   test('suggested quantities from tier thresholds', async () => {})
   ```

## Критерии приёмки

- ✅ credit_pricing_tiers (min_quantity, price_per_credit, active)
- ✅ Seed дефолтной сетки (1/10/30/100 → 5/4/3.5/3 BYN)
- ✅ calculatePrice: flat-tier (tier с наибольшим min ≤ Q, все Q по цене tier)
- ✅ Границы порогов корректны (Q=9 vs 10, Q=29 vs 30)
- ✅ Произвольное количество (≥1)
- ✅ Q < 1 → invalid_quantity
- ✅ Нет сетки → no_pricing
- ✅ getSuggestedQuantities (подсказки из порогов)
- ✅ Тесты (границы критичны)

## Подсказки

- **Flat-tier (не marginal):** Q=35 → ВСЕ 35 по 3.50 (tier min=30), не 30×X + 5×Y. Проще, понятнее покупателю, соответствует «с какого количества другая цена».
- **Границы порогов — критичный тест.** Q=9 → tier min=1 (5.00); Q=10 → tier min=10 (4.00). Off-by-one здесь = неверная цена. Покрыть тестами.
- **Платформенная сетка** (не per-org) — одна на всех. Root-admin меняет (7.7).
- **Подсказки из порогов** — кнопки быстрого выбора (10/30/100), но покупатель может ввести любое (произвольное Q).
- **minor units** — цена 5.00 BYN = 500. Консистентно с Payment/event.price.

## Не делать

- ❌ Не делать marginal/прогрессивное (flat-tier)
- ❌ Не хардкодить цены (таблица + seed)
- ❌ Не допускать Q < 1
- ❌ Не делать per-org сетки (платформенная)
