---
id: '21.5.2'
phase: '21'
epic: '21.5'
status: todo
release: 'v0.3.1'
sync_state: synced
last_reviewed: 2026-10-28
status_note: 'Пакет 1 из отчёта 21.5.1: LEG-01…LEG-03. Остальные пакеты — 21.5.3, 21.5.4, 21.5.5.'
ref_id: ''
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [FULLSTACK]
depends_on: ['21.5.1', '21.3.1']
supersedes: []
decisions: []
estimated_hours: '8-24'
reference:
  spec: ''
  screens: []
tags: [reference-v3, cleanup]
---

# Task 21.5.2: Удаление наследия, пакет 1: мёртвый код клиента и общих пакетов

## Цель

Удалить объекты `LEG-01`…`LEG-03` принятого отчёта [21.5.1](../operations/reviews/2026-10-28-legacy-inventory.md) без потери функциональности v3.

## Контекст

- Один пакет = одна ветка, один PR, одна область; пакеты 21.5.x не пересекаются по файлам. Следующие пакеты: [21.5.3](21-5-3-legacy-removal-styles.md), [21.5.4](21-5-4-legacy-removal-dev-config-docs.md), [21.5.5](21-5-5-legacy-history-condense.md).
- Старт — после `21.3.1`, чтобы не конфликтовать с задачами фазы 21.
- Риск пакета низкий: деньги, доступ, данные, деплой и откат не затронуты.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` с тестами; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

Состав пакета (доказательства неиспользования — в отчёте, повторить на актуальном `main` до удаления):

| ID     | Объект                                                                                                         | Команда проверки                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| LEG-01 | `apps/web/app/composables/useEvents.ts` (`useEvents`, `useBookings`, `useSubscriptions`)                       | `rg -n "useEvents\|useBookings\|useSubscriptions" apps packages --glob '!node_modules' --glob '!.nuxt'` → только сам файл       |
| LEG-02 | `BOOKING_STATUS_LABELS`, `SUBSCRIPTION_STATUS_LABELS`, `MEMBER_STATUS_LABELS` в `apps/web/app/utils/labels.ts` | `rg -n "BOOKING_STATUS_LABELS\|SUBSCRIPTION_STATUS_LABELS\|MEMBER_STATUS_LABELS" apps packages` → объявления и `labels.test.ts` |
| LEG-03 | `APP_NAME` в `packages/shared/src/index.ts`, `CLOSE_BEFORE_MINUTES` в `packages/core/src/events/schemas.ts`    | `rg -n -w "APP_NAME\|CLOSE_BEFORE_MINUTES" apps packages --glob '!node_modules' --glob '!.nuxt'` → только объявления            |

## Что должно быть сделано

1. Повторить команды проверки на текущем `main`; если у объекта появился потребитель, исключить его из пакета и записать в отчёте.
2. Удалить `LEG-01`…`LEG-03`. Не удалять `DEFAULT_CLOSE_BEFORE_MINUTES`, схему `CloseBeforeMinutes` и остальные экспорты `labels.ts` (`EVENT_STATUS_LABELS`, `ROLE_LABELS` и др.).
3. В `apps/web/app/utils/labels.test.ts` заменить пример `BOOKING_STATUS_LABELS` на оставшуюся таблицу (например `EVENT_STATUS_LABELS` или `ROLE_LABELS`), сохранив проверку `label()` и значения по умолчанию.
4. Проверить `rg` по именам удалённого (код, тесты, документы живых разделов); исторические карточки фазы 5 в `docs/tasks` не править.
5. Обновить отчёт аудита: статус `LEG-01`…`LEG-03` — удалено + номер PR.

## Критерии приёмки

- ✅ Удалены только `LEG-01`…`LEG-03`; список совпадает с составом пакета
- ✅ Пять gates на tested revision; сборка зелёная; число тестов изменилось только на удалённые
- ✅ `rg` по именам удалённых объектов не находит живых ссылок
- ✅ Данные, схема и миграции не изменены (diff не содержит миграций и rollback-скриптов `packages/db`)
- ✅ Ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не удалять ничего, чего нет в принятом отчёте аудита 21.5.1
- ❌ Не трогать данные, миграции, rollback-скрипты и quiescent-guard
- ❌ Не объединять несколько областей в один PR и не смешивать с исправлениями огрехов 21.4
- ❌ Не удалять `status-model` (`pendingOf`, `overlapsOf`, `OVERLAP_LABEL`) и `settingsErrorMessage`: пункты LEG-14 и LEG-15 ждут перепроверки после 21.3.1
- ❌ Не удалять `legacy/python-prototype` и документы фаз 1–2 без решения владельца
