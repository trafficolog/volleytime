---
id: '3.11.11'
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

# Task 3.11.11: Удалить синие декоративные тени

## Цель

Удалить синие декоративные тени; исправить наблюдаемый дефект без изменения MVP-бизнес-правил.

## Контекст

Пользователь требует убрать синюю тень со всех кнопок и блоков.

## Что должно быть сделано

Убрать синюю декоративную elevation из общих atoms/tokens и локальных стилей desktop, Mini App, auth и landing. Сохранить нейтральные тени и доступный focus-visible ring: это индикатор фокуса, а не декоративная тень.

Отдельная ветка и RED→GREEN→refactor. После scoped verification выполнить пять gates: format:check, lint, typecheck, test с PostgreSQL, build. Затем независимое task review и exact-head CI до merge main.

## Критерии приёмки

RED→GREEN CSS contracts; аудит локальных shadow declarations. Browser representative primary button/hero card/landing light/dark и keyboard focus: синяя elevation отсутствует, фокус различим.

QA evidence фиксирует точный SHA, размеры, тему, сценарии и результаты; repository/browser evidence не выдаётся за Telegram QA.

## Подсказки

Релиз R0.6/v0.1.6 остаётся кандидатом. Текущий production candidate 64f1850; controlled redeploy только по runbook после интеграции проверенных задач. Предыдущие пользовательские 200%/screen-reader evidence сохраняются, но не заменяют regression новых правок.

## Не делать

Не менять API/БД/права, не расширять функциональность будущих фаз, не публиковать непроверенный код на VPS, не переписывать теги. Не менять другие task cards и shared status при работе над отдельной задачей: интеграционную документацию синхронизирует controller.
