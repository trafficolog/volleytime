---
id: '23.2.2'
phase: '23'
epic: '23.2'
status: done
release: 'v0.5.0'
sync_state: synced
last_reviewed: 2026-11-22
status_note: 'Слито в main PR #327 (b9ed7878) 2026-11-22; ревью claude-opus-5-5 без Critical/Important, CI зелёный. Вкладка «Календарь» включена (CALENDAR_PAGE_READY = true). Открытые вопросы владельцу: постоянный цвет группы (нужна схема), показ отменённых игр приглушёнными. Войдёт в production с v0.5.0.'
ref_id: 'M-10'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['19.2.1', '19.1.2', '23.1.1']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-10-my-calendar.md'
  screens: ['9-ideas-overview']
tags: [reference-v3]
---

# Task 23.2.2: Общий календарь по всем группам (`M-10`)

## Цель

Все игры игрока из всех групп в одном месте.

## Контекст

- Спецификация референса: [M-10 · Общий календарь](../design/reference-v3/specs/02-mini-app/M-10-my-calendar.md); макет: 3 Mini App → Календарь; 9 Гипотезы → Мой календарь.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** `MyCalendar`: все группы одним запросом, цвет группы, пересечения amber, «Только мои» / «С местами».
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Календари и расписание** — Общий календарь игрока, расписание группы и календарь кабинета читают одни события. С этим связаны: [M-11 → 21.1.4](21-1-4-group-schedule.md), [W-03 → 20.5.4](20-5-4-events.md), [P-06 → 20.2.2](20-2-2-event-series.md). [Подробнее](../design/reference-v3/specs/links.md#calendar)

## Что должно быть сделано

1. Месяц и список
2. Цвет группы точкой
3. Пересечения по времени
4. Фильтр «Только мои» / «С местами»
5. Переход в событие нужной группы
6. Состояния экрана: Нет записей в месяце; Пересечение двух игр.
7. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

8. Включить вкладку «Календарь» в таб-баре игрока: `CALENDAR_PAGE_READY = true` в `apps/web/app/utils/player-navigation.ts` (из [23.1.1](23-1-1-player-features.md), решение владельца 2026-11-22).

## Критерии приёмки

- ✅ Данные из всех групп игрока одним запросом
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [9-ideas-overview](../design/reference-v3/screenshots/9-ideas-overview) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/idea-app.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-a.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-b.jsx`, `docs/design/reference-v3/handoff/screens-ideas-future.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
