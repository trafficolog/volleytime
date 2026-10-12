---
id: '21.1.4'
phase: '21'
epic: '21.1'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-11'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.1.2']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-11-group-schedule.md'
  screens: ['3-miniapp-player/13-screen.png', '3-miniapp-organizer/10-screen.png']
tags: [reference-v3]
---

# Task 21.1.4: Расписание группы на месяц (игрок и организатор) (`M-11`)

## Цель

Месяц игр одной группы.

## Контекст

- Спецификация референса: [M-11 · Расписание группы](../design/reference-v3/specs/02-mini-app/M-11-group-schedule.md); макет: 3 Mini App → Расписание.
- **Как есть (main `e68acf2`):** Список событий без месячного вида.
- **Дельта до референса:** `ScheduleMonth role="player|org"`: месяцы, «Календарь / Список по неделям», фильтр «Мои», точка залитая/контурная, тап по дню → список.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Календари и расписание** — Общий календарь игрока, расписание группы и календарь кабинета читают одни события. С этим связаны: [M-10 → 23.2.2](23-2-2-my-calendar.md), [W-03 → 20.5.4](20-5-4-events.md), [P-06 → 20.2.2](20-2-2-event-series.md). [Подробнее](../design/reference-v3/specs/links.md#calendar)

## Что должно быть сделано

1. Месяц, несколько событий в день
2. Переход в событие
3. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Работает при выключенном общем календаре
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-player/13-screen.png](../design/reference-v3/screenshots/3-miniapp-player/13-screen.png), [3-miniapp-organizer/10-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/10-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-schedule.jsx`, `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`, `docs/design/reference-v3/handoff/screens-organizer.jsx`, `docs/design/reference-v3/handoff/screens-contributions.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
