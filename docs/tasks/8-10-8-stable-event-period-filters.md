---
id: '8.10.8'
phase: '8'
epic: '8.10'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-30
status_note: 'Mounted RED→GREEN 7/7; synthetic Chrome 320/390 light/dark native/browser back geometry stable (header 64px, filter Y64px). Full gates/review/CI pending; real Telegram QA not claimed.'
review_ref: '2026-09-30 production Telegram pilot screenshots'
priority: P2
roles: [FE, QA]
depends_on: ['3.11.2', '8.10.2']
tags: [r06, pilot, ui, review-fix]
---

# Task 8.10.8: Стабильные микрофильтры событий

## Цель

Стабильные микрофильтры событий; исправить наблюдаемый дефект без изменения MVP-бизнес-правил.

## Контекст

При смене периода события виден прыжок. Исходный код скрывает header create action во время loading; фильтры должны оставаться на месте.

## Что должно быть сделано

Воспроизвести delayed GET; оставить header и фильтры mounted с неизменной геометрией/фокусом. Обновлять только область записей ниже (skeleton/error/empty/list); сохранить latest-request guards и запрет неверных старых данных. Create action можно disabled на время запроса, но не убирать с изменением высоты.

Отдельная ветка и RED→GREEN→refactor. После scoped verification выполнить пять gates: format:check, lint, typecheck, test с PostgreSQL, build. Затем независимое task review и exact-head CI до merge main.

## Критерии приёмки

Mounted RED→GREEN для delayed response/rapid toggle/error/retry. Browser измерение header/filter rect до/во время/после GET при 320/390 light/dark; фокус сохранён, только последняя выборка, error не показывает ложный empty. Роли и реальные операции без изменений.

QA evidence фиксирует точный SHA, размеры, тему, сценарии и результаты; repository/browser evidence не выдаётся за Telegram QA.

## Evidence 2026-09-30

- Mounted deferred RED: header action disappears during loading/error (2 failed, 5 passed); GREEN 7/7 checks persistent action/filter focus, disabled navigation, error/retry, latest responses and role/access constraints.
- Synthetic Chrome matrix: 320/390 × light/dark × SDK native back/browser back — 8/8 pass. Header remains 64px; filter rect Y64px/height54.5px before/during/after request, error/retry and rapid toggle. No stale past rows or false empty; disabled create does not navigate on click/Enter.
- Local header uses a persistent native disabled button guarded by existing canCreate. Request/access guards and content state order unchanged. No shared CSS changes.
- Exact SHA and gate/review outcomes recorded in controller task evidence after verification; independent review, exact-head CI and real Telegram acceptance remain open.

## Подсказки

Релиз R0.6/v0.1.6 остаётся кандидатом. Текущий production candidate 64f1850; controlled redeploy только по runbook после интеграции проверенных задач. Предыдущие пользовательские 200%/screen-reader evidence сохраняются, но не заменяют regression новых правок.

## Не делать

Не менять API/БД/права, не расширять функциональность будущих фаз, не публиковать непроверенный код на VPS, не переписывать теги. Не менять другие task cards и shared status при работе над отдельной задачей: интеграционную документацию синхронизирует controller.
