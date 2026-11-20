---
id: '28.1.3'
phase: '28'
epic: '28.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-20
status_note: 'Запрос владельца 2026-11-20.'
ref_id: ''
review_ref: ''
priority: P2
complexity: S
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [DevOps]
depends_on: ['28.1.2']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [tooling, graphify]
---

# Task 28.1.3: Граф кода (AST, локально) и базовая оценка

## Цель

Построить граф кода без LLM и понять, полезен ли он на этом репозитории.

## Контекст

- Настройка — [28.1.2](28-1-2-graphify-install-config.md). AST-режим работает локально, данные не уходят с машины ([28.1.1](28-1-1-graphify-evaluation.md)).

## Что должно быть сделано

1. Построить граф только кода (`apps/`, `packages/`, скрипты) без семантического прохода: в окружении нет `ANTHROPIC_API_KEY` и других ключей backend, интеграция с ассистентом не установлена.
2. Повторить проверку `graph.json` из [28.1.2](28-1-2-graphify-install-config.md): секреты, IP-адреса, имена хостов VPS, пути `docs/operations` — ноль совпадений.
3. Записать базовую линию в guide: версия, время сборки, число узлов и рёбер, языки, что не разобралось (например, `.vue`).
4. Пять контрольных вопросов с известным ответом (например: путь от эндпоинта записи на событие до таблицы, кто вызывает расчёт баланса, где проверяется initData) — `graphify query|path|explain`; сравнить с ответом по коду. Оценка: верно / частично / неверно.
5. Вывод в карточке: стоит ли продолжать 28.1.4–28.1.5.

## Критерии приёмки

- ✅ Базовая линия и результаты пяти вопросов записаны
- ✅ Проверка `graph.json` на секреты, IP и хосты пуста
- ✅ `graphify-out/` не в git
- ✅ Ревью `claude-sonnet-5-5` без Critical/Important

## Не делать

- ❌ Не коммитить `graph.json`, `graph.html`, `GRAPH_REPORT.md`
- ❌ Не включать backend LLM и `--wiki`
