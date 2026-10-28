---
id: '21.5.9'
phase: '21'
epic: '21.5'
status: todo
release: 'v0.3.1'
sync_state: synced
last_reviewed: 2026-10-28
status_note: 'Решение владельца OQ-8 (2026-10-28): удалить readEventPricing и проекцию pricing после 21.2.18 и 21.2.1, когда все экраны используют новые данные; цифры денег не должны измениться. Пакет из отчёта 21.5.1: LEG-17.'
ref_id: ''
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [FULLSTACK, QA]
depends_on: ['21.5.1', '21.3.1', '21.2.18', '21.2.1']
supersedes: []
decisions: []
estimated_hours: '8-24'
reference:
  spec: ''
  screens: []
tags: [reference-v3, cleanup, money]
---

# Task 21.5.9: Удаление наследия, `readEventPricing` и проекция `pricing`

## Цель

Удалить старый расчёт `readEventPricing` и проекцию `pricing` в ответах API, переведя оставшихся потребителей на новые данные (`GET …/price`/`quoteEventPrice`, `seatPayments`, ответы 21.2.18), так, чтобы ни одна денежная цифра в Mini App, кабинете и боте не изменилась (`LEG-17` принятого отчёта [21.5.1](../operations/reviews/2026-10-28-legacy-inventory.md)).

## Контекст

- Решение владельца **OQ-8** ([журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md), запись 2026-10-28): удалить после [21.2.18](21-2-18-overview-api.md) и [21.2.1](21-2-1-overview.md), когда все экраны используют новые данные.
- **Деньги:** карточка попадает под правило ORCHESTRATION №1 — ревью `claude-opus-5-5` с тестами граничных случаев и гонок. Пакет не должен менять расчёт долей, округление копеек (D-01) и статусы оплаты; он переносит источник данных.
- Состав на срез аудита (повторить на актуальном `main`): `rg -n "readEventPricing" apps packages --glob '!*.test.ts' --glob '!node_modules'` → серверные маршруты `bookings/my.get.ts`, `dashboard.get.ts` (3 вызова), `events/index.get.ts`, `events/[eventId]/index.get.ts`, экспорт `packages/core/src/events/index.ts`, реализация `packages/core/src/events/pricing-read-model.ts`. Клиентские потребители поля `pricing`: `pages/m/orgs/[orgId]/bookings.vue`, `utils/event-row.ts`, `utils/player-event.ts`, `utils/event-pricing-label.ts`, `utils/__fixtures__/split-quote.ts`; тесты, использующие `readEventPricing`: `packages/core/src/events/split-settlement.integration.test.ts`, `pricing-overbooked.integration.test.ts`, `packages/core/src/bookings/multi-seat.integration.test.ts`, `apps/web/server/__tests__/event-price.integration.test.ts` и interaction-тесты, фикстуры которых намеренно расходятся с ответом цены.
- Остаются без изменений: `readEventPriceQuote`, `readPlayerPriceQuote`, `quoteEventPrice`, `readMySeatPayments` и `seatPayments` (21.1.8).
- Бот-маршруты `internal/bot/*` `readEventPricing` не вызывают; проверка идентичности включает тексты бота «Мои записи»/анонсы, если они формируют цену.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` с тестами; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Проверить, что 21.2.18 и 21.2.1 в `done`, а все экраны Mini App и кабинета читают цену из `GET …/price`/`quoteEventPrice` и статус оплаты из `seatPayments`/ответов 21.2.18. Составить таблицу «поле `pricing` → источник замены → потребитель»; если у какого-то поля нет замены, остановиться и вернуть задачу оркестратору (новые функции в этот пакет не входят).
2. **Снимок до (RED/паритет):** для набора сценариев (fixed и split; открытая запись, закрытая, рассчитанная; несколько мест; переполнение; отменённая запись; организатор и игрок) зафиксировать денежные цифры текущих ответов `bookings/my`, `events`, `events/{id}`, `dashboard` и их отображение (Mini App, кабинет, текст бота) в тесте паритета. Тест проходит на коде до изменений.
3. Перевести потребителей и тесты на новые источники; удалить поле `pricing` из ответов API и типов клиента, функцию `readEventPricing` и экспорт. Интеграционные тесты, проверявшие цифры через `readEventPricing`, переписать на `quoteEventPrice`/`seatPayments` с теми же ожидаемыми значениями (не ослабляя утверждения).
4. **Снимок после (GREEN):** тест паритета проходит без правок ожидаемых цифр; отдельные тесты граничных случаев: split с округлением копеек, переполнение состава, отмена после оплаты, несколько мест, рассчитанное событие, права просмотра (игрок не видит чужие суммы).
5. IDOR-проверка маршрутов, чьи ответы изменились: игрок не получает чужие суммы и платежи, организатор видит свои.
6. Обновить отчёт аудита: статус `LEG-17` — удалено + номер PR и таблица замены.

## Критерии приёмки

- ✅ `rg -n "readEventPricing"` находит только историю в документах; поле `pricing` нет в ответах API и типах клиента
- ✅ Тест паритета: денежные цифры Mini App, кабинета и бота до и после совпадают в каждом сценарии
- ✅ Пять gates на tested revision (интеграционные тесты на PostgreSQL выполнены, не пропущены); число утверждений о деньгах не уменьшено
- ✅ Данные, схема и миграции не изменены; расчёт долей и округление не изменены
- ✅ Ревью `claude-opus-5-5` без Critical/Important; ревью включает тесты граничных случаев и IDOR

## Не делать

- ❌ Не начинать до `done` 21.2.18 и 21.2.1 и без перехода всех экранов на новые данные
- ❌ Не менять формулы расчёта долей, округление, цену `quoteEventPrice` и статусы оплаты
- ❌ Не добавлять новые поля или функции API: только перенос источника и удаление старого
- ❌ Не ослаблять и не удалять утверждения о денежных цифрах в тестах
- ❌ Не трогать данные, миграции, rollback-скрипты
