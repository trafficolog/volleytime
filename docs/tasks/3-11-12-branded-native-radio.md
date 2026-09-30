---
id: '3.11.12'
phase: '3'
epic: '3.11'
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

# Task 3.11.12: Брендовые радиокнопки настроек

## Цель

Брендовые радиокнопки настроек; исправить наблюдаемый дефект без изменения MVP-бизнес-правил.

## Контекст

На скриншоте Settings radio остаются системными, тогда как checkbox брендовый.

## Что должно быть сделано

Стилизовать native radio настроек desktop/Mini App в брендовой системе, размер 20×20 CSS px как checkbox; сохранить input type=radio, группировку name, label, checked/disabled/focus, клавиатуру и server semantics. Без JS-псевдо-radio.

Отдельная ветка и RED→GREEN→refactor. После scoped verification выполнить пять gates: format:check, lint, typecheck, test с PostgreSQL, build. Затем независимое task review и exact-head CI до merge main.

## Критерии приёмки

RED→GREEN regression native inputs и CSS; browser 320/390 light/dark, checked/unchecked/disabled, click label и arrow/space keyboard, distinct focus. Модель membership policy и сохранение не меняются.

QA evidence фиксирует точный SHA, размеры, тему, сценарии и результаты; repository/browser evidence не выдаётся за Telegram QA.

## Подсказки

Релиз R0.6/v0.1.6 остаётся кандидатом. Текущий production candidate 64f1850; controlled redeploy только по runbook после интеграции проверенных задач. Предыдущие пользовательские 200%/screen-reader evidence сохраняются, но не заменяют regression новых правок.

## Не делать

Не менять API/БД/права, не расширять функциональность будущих фаз, не публиковать непроверенный код на VPS, не переписывать теги. Не менять другие task cards и shared status при работе над отдельной задачей: интеграционную документацию синхронизирует controller.
