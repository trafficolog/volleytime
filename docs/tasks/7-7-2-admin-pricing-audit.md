---
id: '7.7.2'
phase: '7'
epic: '7.7'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
  - FE
depends_on:
  - '7.7.1'
  - '7.4.2'
estimated_hours: '1-2'
tags:
  - credits
  - admin
  - pricing
---

# Task 7.7.2: Управление тарифами + audit транзакций (super-admin)

## Цель

Super-admin: управление тарифной сеткой (просмотр/редактирование порогов/цен) + audit credit-транзакций по организациям.

## Контекст

Решение 4: root-admin настраивает сетку (для экспериментов с ценой тоже). Решение 7: audit. Завершает root-admin функционал Phase 7.

## Что должно быть сделано

1. **Тарифы endpoints** (super-admin):

   ```
   GET  /api/admin/pricing-tiers        → listTiers (7.4.2)
   PUT  /api/admin/pricing-tiers        → replaceTiers (7.4.2, валидация)
   ```

   ```ts
   // PUT
   export default defineEventHandler(async (event) => {
     await requireSuperAdmin(event)
     const ctx = createServiceContextFromEvent(event)
     const { tiers } = await readBody(event) // [{ minQuantity, pricePerCredit }]
     await pricingService.replaceTiers(ctx, tiers)
     return { ok: true }
   })
   ```

2. **Audit endpoint** — credit-транзакции по организациям:

   ```
   GET /api/admin/credits/transactions?organizationId=&type=&limit=&offset=
   ```

   Все транзакции (фильтр по орг/типу), для аудита движений credits.

3. **Super-admin UI** (расширить):

   ```vue
   <!-- Тарифная сетка: таблица порогов (min_quantity → price_per_credit), редактируемая -->
   <!-- добавить/убрать строку, сохранить (replaceTiers) -->
   <!-- валидация на фронте (начало с 1, возрастание, положительные) -->

   <!-- Audit: лента credit-транзакций (фильтр орг/тип) -->
   ```

4. **Редактирование сетки** — таблица строк, добавить/убрать порог, сохранить целиком (replaceTiers). Показать примеры расчёта (Q=10 → X, Q=50 → Y) для проверки.

5. **Тесты:**
   ```ts
   test('super-admin lists pricing tiers', async () => {})
   test('super-admin replaces tiers (valid)', async () => {})
   test('super-admin replace invalid tiers → error', async () => {})
   test('audit lists transactions filtered', async () => {})
   test('non-admin cannot edit tiers', async () => {})
   ```

## Критерии приёмки

- ✅ GET/PUT pricing-tiers (super-admin, валидация при replace)
- ✅ Audit транзакций (фильтр орг/тип)
- ✅ UI: редактируемая сетка (добавить/убрать/сохранить)
- ✅ UI: audit-лента
- ✅ Опц примеры расчёта при редактировании
- ✅ Только super-admin
- ✅ Тесты

## Подсказки

- **replaceTiers целиком** (7.4.2) — UI показывает всю сетку, правишь, сохраняешь. Атомарная замена.
- **Примеры расчёта** при редактировании — сразу видно эффект (Q=10 → 40 BYN). Помогает не ошибиться с ценой.
- **Audit для прозрачности** — все движения credits видны (кто, когда, сколько, за что). Финансовая дисциплина.
- **Эксперименты с ценой (вариант C)** — меняешь сетку, новые заявки по новой цене (старые зафиксированы 7.5.1).

## Не делать

- ❌ Не давать редактировать тарифы организаторам
- ❌ Не пересчитывать старые заявки при смене сетки
- ❌ Не делать сложную BI (простой audit-список)
