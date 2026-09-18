---
id: '10.3.2'
phase: '10'
epic: '10.3'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
  - FE
depends_on:
  - '10.3.1'
  - '10.1.2'
estimated_hours: '1'
tags:
  - beta
  - super-admin
  - metrics
---

# Task 10.3.2: Гейт-метрики агрегация + allowlist управление

## Цель

Агрегация гейт-метрик в super-admin обзоре (помогает оценивать готовность к Phase 7). Управление allowlist из super-admin (добавить/убрать организатора).

## Контекст

Решения 2, 5: гейт-метрики на виду, управление allowlist. Super-admin видит прогресс беты к гейт-критериям и пополняет allowlist при онбординге.

## Что должно быть сделано

1. **Гейт-метрики агрегация `apps/web/server/api/admin/gate-metrics.get.ts`:**

   ```ts
   export default defineEventHandler(async (event) => {
     await requireSuperAdmin(event)
     // агрегаты по всем бета-организациям
     const totalEvents = await countAllEvents()
     const totalBookings = await countAllBookings()
     const activeOrgs = await countActiveOrgs(30) // активны последние 30 дней
     const retentionOrgs = await orgsWithConsecutiveWeeks(4) // ≥4 недели подряд
     const miniAppRatio = await computeMiniAppRatio() // % операций через Mini App (если трекается)

     return {
       gate: {
         activeOrganizers: { value: activeOrgs, target: 2 },
         retention4weeks: { value: retentionOrgs, target: 1 },
         totalEvents: { value: totalEvents, target: 50 },
         totalBookings: { value: totalBookings, target: 200 },
         // willingnessToPay — ручная оценка (опрос), не авто
         miniAppRatio: { value: miniAppRatio, target: 0.8 },
       },
     }
   })
   ```

2. **Ретеншн-расчёт** — организаторы с событиями ≥4 недели подряд:

   ```ts
   // для каждой org: проверить что есть событие в каждой из последних 4 недель
   async function orgsWithConsecutiveWeeks(weeks: number): Promise<number> {
     // группировка событий по неделям per org, проверка непрерывности
   }
   ```

3. **Allowlist управление в super-admin странице:**

   ```vue
   <!-- секция allowlist: список + добавить (telegram_id + note) + убрать -->
   <!-- использует allowlistService (10.1.2) через /api/admin/allowlist -->
   ```

4. **% через Mini App** — если не трекается отдельно, оценить косвенно (большинство операций в бете через Mini App по дизайну) или пометить как ручную оценку. Для MVP можно ручная оценка (бета мала).

5. **Willingness to pay** — НЕ автометрика (требует прямого вопроса). Поле для ручной отметки в decision review (10.6.1), не агрегация.

6. **Отображение** — гейт-метрики на super-admin странице: значение / цель, цветовой индикатор (достигнуто/нет).

## Критерии приёмки

- ✅ Гейт-метрики агрегация (события, брони, активные орг, ретеншн)
- ✅ Ретеншн: организаторы ≥4 недели подряд с событиями
- ✅ Метрики value/target на super-admin странице
- ✅ Allowlist управление (список, добавить, убрать) из super-admin
- ✅ Mini App ratio: авто или помечено как ручная оценка
- ✅ Willingness to pay — отдельно (ручная оценка в 10.6)

## Подсказки

- **Ретеншн — главная метрика (решение 2).** Возвращается ли организатор неделя-к-неделе. ≥4 недели подряд = устойчивое использование, не разовый интерес.
- **Не всё автоматизируется** — willingness to pay (прямой вопрос), часть Mini App ratio — ручная оценка. Для 2-5 орг это ок, не строить тяжёлую аналитику.
- **value/target визуально** — сразу видно прогресс к гейту (3/50 событий vs 52/50).
- **Allowlist в одном месте с обзором** — удобно: вижу активность + управляю доступом.

## Не делать

- ❌ Не строить сложную BI (простые агрегаты)
- ❌ Не автоматизировать willingness to pay (прямой вопрос)
- ❌ Не делать трекинг каждого клика для Mini App ratio (избыточно для беты)
