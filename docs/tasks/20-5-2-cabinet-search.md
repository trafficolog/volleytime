---
id: '20.5.2'
phase: '20'
epic: '20.5'
status: in_progress
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: 'GET /api/organizations/{orgId}/search + поиск в топбаре кабинета реализованы (PR ниже); ожидает ревью Opus. Без миграции: ILIKE по строкам группы, < 300 мс на 2000 игроков (тест).'
ref_id: 'P-13'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [BACK]
depends_on: ['19.2.1', '19.3.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-13-cabinet-search.md'
  screens: []
tags: [reference-v3]
---

# Task 20.5.2: Поиск кабинета (`P-13`)

## Цель

Быстрый поиск по данным группы.

## Контекст

- Спецификация референса: [P-13 · Поиск кабинета](../design/reference-v3/specs/01-platform/P-13-cabinet-search.md); макет: 4 Кабинет → поиск в топбаре.
- **Как есть (main `e68acf2`):** Поиска нет.
- **Дельта до референса:** `GET /search?q=` по игрокам, событиям и платежам в пределах прав; < 300 мс на 2000 игроков (индексы).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Поиск** — Поиск топбара кабинета. С этим связаны: [W-01 → 20.5.3](20-5-3-cabinet-shell.md). [Подробнее](../design/reference-v3/specs/links.md#search)

## Что должно быть сделано

1. Игроки, события, платежи
2. Результаты сгруппированы по типу
3. Только в пределах прав пользователя
4. Данные и API: GET /search?q=.

## Критерии приёмки

- ✅ Ответ < 300 мс на группе из 2000 игроков
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
