---
id: '30.3.3'
phase: '30'
epic: '30.3'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-24
status_note: 'Перепланирование 19.0.5 (референс 2026-11-24). Релиз назначает владелец.'
ref_id: 'M-32'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, BACK]
depends_on: ['24.1.1', '19.2.3']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-32-nearby-games.md'
  screens: []
tags: [reference-v3]
---

# Task 30.3.3: Открытые игры рядом

## Цель

Лента публичных событий других групп по городу и уровню.

## Контекст

- Спецификация референса: [M-32 · Открытые игры рядом](../design/reference-v3/specs/02-mini-app/M-32-nearby-games.md); обновление референса — [отчёт 2026-11-24](../design/2026-11-24-reference-v3-update.md).
- Макет: 3 Mini App → Профиль → Открытые игры рядом.
- **Как есть (main `69a5595`):** каталог города `/volleyball/<город>` (24.1.2) показывает группы, но не ближайшие открытые игры.
- **Дельта до референса:** всё, что в «Что должно быть сделано»; работающее не переписывается.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5`; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

**Объём** (по спецификации)

- Фильтр «мой уровень В1–В4+»
- Только события, которые группа сделала публичными
- Переход на страницу группы, запись по её правилам

## Критерии приёмки

- ✅ Закрытые и «по приглашению» события в ленту не попадают
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, токены, доменная логика.
- Гипотеза из волны 1 референса: за флагом функции игрока (23.1.1), метрики — 23.1.2.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
