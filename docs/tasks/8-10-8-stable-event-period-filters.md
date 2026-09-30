---
id: '8.10.8'
phase: '8'
epic: '8.10'
status: todo
sync_state: synced
last_reviewed: 2026-09-30
status_note: 'SDD до кода; пользователь подтвердил продолжение исправлений. Acceptance/review/CI ещё открыты.'
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

## Подсказки

Релиз R0.6/v0.1.6 остаётся кандидатом. Текущий production candidate 64f1850; controlled redeploy только по runbook после интеграции проверенных задач. Предыдущие пользовательские 200%/screen-reader evidence сохраняются, но не заменяют regression новых правок.

## Не делать

Не менять API/БД/права, не расширять функциональность будущих фаз, не публиковать непроверенный код на VPS, не переписывать теги. Не менять другие task cards и shared status при работе над отдельной задачей: интеграционную документацию синхронизирует controller.
