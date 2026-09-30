---
id: '8.10.7'
phase: '8'
epic: '8.10'
status: done
sync_state: synced
last_reviewed: 2026-09-30
status_note: 'Принята PR #72 в main=4a48cdb: RED→GREEN, 20 browser status cases, пять gates131/889, независимое review и exact-head/main CI passed. Telegram regression после controlled redeploy отдельно; см. 2026-09-30-r06-pilot-ui-fixes.md.'
review_ref: '2026-09-30 production Telegram pilot screenshots'
priority: P2
roles: [FE, QA]
depends_on: ['3.11.2', '8.10.2']
tags: [r06, pilot, ui, review-fix]
---

# Task 8.10.7: Полный статус события на узком экране

## Цель

Полный статус события на узком экране; исправить наблюдаемый дефект без изменения MVP-бизнес-правил.

## Контекст

Скриншоты production Telegram от 2026-09-30 показывают выход «Опубликовано» за границу chip.

## Что должно быть сделано

OrganizerEventRow: сохранить полный текст статуса без clipping, уменьшения текста до нечитаемого размера или горизонтального overflow. При нехватке места переносить компоновку, сохраняя дату, название, площадку и счётчик.

Отдельная ветка и RED→GREEN→refactor. После scoped verification выполнить пять gates: format:check, lint, typecheck, test с PostgreSQL, build. Затем независимое task review и exact-head CI до merge main.

## Критерии приёмки

Mounted regression и browser RED→GREEN; 320/390 CSS px, light/dark, длинные название/площадка, все существующие статусы. Полный статус читаем, chip и строка внутри viewport, ссылка события работает.

QA evidence фиксирует точный SHA, размеры, тему, сценарии и результаты; repository/browser evidence не выдаётся за Telegram QA.

## Подсказки

Релиз R0.6/v0.1.6 остаётся кандидатом. Текущий production candidate 64f1850; controlled redeploy только по runbook после интеграции проверенных задач. Предыдущие пользовательские 200%/screen-reader evidence сохраняются, но не заменяют regression новых правок.

## Не делать

Не менять API/БД/права, не расширять функциональность будущих фаз, не публиковать непроверенный код на VPS, не переписывать теги. Не менять другие task cards и shared status при работе над отдельной задачей: интеграционную документацию синхронизирует controller.
