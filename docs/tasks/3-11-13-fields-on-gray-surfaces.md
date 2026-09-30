---
id: '3.11.13'
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

# Task 3.11.13: Различимые поля внутри серых карточек

## Цель

Различимые поля внутри серых карточек; исправить наблюдаемый дефект без изменения MVP-бизнес-правил.

## Контекст

Поля и серый фон карточки сливаются, выглядят статичным текстом.

## Что должно быть сделано

Только внутри серых surface/card отличить текстовые input, textarea, select, date/time и другие действующие поля: светлая поверхность с нейтральной границей в light, различимая поверхность в dark. Сохранить внешние поля и палитру, focus/error/readonly/disabled; не превращать кнопки/checkbox/radio в текстовые поля.

Отдельная ветка и RED→GREEN→refactor. После scoped verification выполнить пять gates: format:check, lint, typecheck, test с PostgreSQL, build. Затем независимое task review и exact-head CI до merge main.

## Критерии приёмки

RED→GREEN CSS/component contracts; browser settings/event form/cashbox form light/dark 320/390 и desktop, ввод/выбор/disabled/readonly/focus различимы. Контраст проверить и записать; реальные значения и API не меняются.

QA evidence фиксирует точный SHA, размеры, тему, сценарии и результаты; repository/browser evidence не выдаётся за Telegram QA.

## Подсказки

Релиз R0.6/v0.1.6 остаётся кандидатом. Текущий production candidate 64f1850; controlled redeploy только по runbook после интеграции проверенных задач. Предыдущие пользовательские 200%/screen-reader evidence сохраняются, но не заменяют regression новых правок.

## Не делать

Не менять API/БД/права, не расширять функциональность будущих фаз, не публиковать непроверенный код на VPS, не переписывать теги. Не менять другие task cards и shared status при работе над отдельной задачей: интеграционную документацию синхронизирует controller.
