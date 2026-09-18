---
id: '7.8.2'
phase: '7'
epic: '7.8'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - QA
  - BACK
depends_on:
  - '7.4.1'
  - '7.4.2'
  - '7.5.1'
estimated_hours: '1-2'
tags:
  - tests
  - credits
  - pricing
---

# Task 7.8.2: Pricing tiers + purchase request tests

## Цель

Тесты тарифной сетки (flat-tier расчёт, границы порогов, валидация) и заявок на покупку (create/confirm/reject, фиксация цены, идемпотентность).

## Контекст

Тарифный расчёт (вариант C) — границы порогов критичны (off-by-one = неверная цена). Заявки — фиксация цены и идемпотентность подтверждения.

## Что должно быть сделано

1. **Pricing tests `apps/web/modules/credits/__tests__/pricing.test.ts`:**

   ```ts
   describe('calculatePrice (flat-tier)', () => {
     // сетка: 1→500, 10→400, 30→350, 100→300
     test('Q=1 → 500 (5.00), total 500', async () => {})
     test('Q=5 → tier min=1, total 2500', async () => {})
     test('Q=9 → tier min=1 (boundary)', async () => {})
     test('Q=10 → tier min=10 (4.00), total 4000', async () => {})
     test('Q=29 → tier min=10 (boundary)', async () => {})
     test('Q=30 → tier min=30 (3.50), total 10500', async () => {})
     test('Q=35 → tier min=30, total 12250', async () => {})
     test('Q=100 → tier min=100 (3.00), total 30000', async () => {})
     test('Q=150 → tier min=100, total 45000', async () => {})
     test('Q=0 → invalid_quantity', async () => {})
   })

   describe('replaceTiers validation', () => {
     test('valid grid accepted', async () => {})
     test('must start at minQuantity=1', async () => {})
     test('negative price rejected', async () => {})
     test('duplicate threshold rejected', async () => {})
     test('empty grid rejected', async () => {})
     test('old tiers deactivated on replace', async () => {})
   })
   ```

2. **Purchase request tests `purchase.test.ts`:**

   ```ts
   describe('purchase requests', () => {
     test('createRequest fixes price from grid', async () => {})
     test('confirmRequest grants exact quantity', async () => {})
     test('confirm marks confirmed + processedBy', async () => {})
     test('confirm non-pending → request_not_pending', async () => {})
     test('reject → rejected, no credits granted', async () => {})
     test('price fixed at request time (grid change after no effect)', async () => {})
     test('confirmed request → purchase transaction with priceAmount', async () => {})
   })
   ```

3. **Граничные пороги — особый фокус:** Q на границе (9/10, 29/30, 99/100) — правильный tier.

4. **Фиксация цены:** заявка создана по сетке X → root меняет сетку → confirm по старой цене X.

## Критерии приёмки

- ✅ calculatePrice: все tier-границы (1/10/30/100), произвольные Q
- ✅ Границы off-by-one (Q=9 vs 10, 29 vs 30, 99 vs 100)
- ✅ Q=0 → invalid
- ✅ replaceTiers валидация (начало с 1, положительные, уникальные, не пустая)
- ✅ Старые тарифы деактивируются
- ✅ Purchase: create фиксирует цену, confirm grant, reject no-grant
- ✅ Идемпотентность confirm
- ✅ Цена фиксирована на момент заявки
- ✅ ≥ 15 тестов

## Подсказки

- **Границы порогов — самое важное** в pricing. Q=9 (5.00) vs Q=10 (4.00) — переход. Off-by-one (≤ vs <) = неверная цена клиенту. Покрыть каждую границу.
- **Фиксация цены** — заявка по сетке на момент создания. Root меняет сетку → старая заявка по старой цене (честность). Тест критичен.
- **Идемпотентность confirm** — двойное подтверждение не даёт двойной grant.

## Не делать

- ❌ Не дублировать core тесты (7.8.1)
- ❌ Не пропускать границы порогов
- ❌ Не делать E2E HTTP
