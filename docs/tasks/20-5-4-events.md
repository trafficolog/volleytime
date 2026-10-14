---
id: '20.5.4'
phase: '20'
epic: '20.5'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-14
status_note: 'PR #124 (f2976b5): таблица W-03, календарь-месяц с загрузкой по диапазону from/to, лист выбора дня, фильтры и месяц сохраняются при смене вида; ревью standard — merge после одного раунда, CI зелёный. Колонка «Оплаты» и меню строки — 20.5.8 (v0.2.0); поиск, «Фильтры», «Экспорт», «Показано N из M» — 21.2.10 (v0.3.0).'
ref_id: 'W-03'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.2.1', '19.1.2']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-03-events.md'
  screens: ['4-cabinet/02-screen.png', '4-cabinet/03-screen.png']
tags: [reference-v3]
---

# Task 20.5.4: События кабинета: список и календарь (`W-03`)

## Цель

Все события группы.

## Контекст

- Спецификация референса: [W-03 · События](../design/reference-v3/specs/03-organizer-web/W-03-events.md); макет: 4 Кабинет организатора → События.
- **Как есть (main `e68acf2`):** Список событий и `EventCalendar` (5.15.1).
- **Дельта до референса:** Несколько событий в дне — стопкой до 2, «+N ещё» → лист выбора; фильтры сохраняются при переключении режимов; статусы 19.1.2.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Календари и расписание** — Общий календарь игрока, расписание группы и календарь кабинета читают одни события. С этим связаны: [M-10 → 23.2.2](23-2-2-my-calendar.md), [M-11 → 21.1.4](21-1-4-group-schedule.md), [P-06 → 20.2.2](20-2-2-event-series.md). [Подробнее](../design/reference-v3/specs/links.md#calendar)

## Что должно быть сделано

1. Список
2. Календарь-месяц
3. Несколько событий в день — всплывающий список выбора
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Переключение режимов сохраняет фильтры
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/02-screen.png](../design/reference-v3/screenshots/4-cabinet/02-screen.png), [4-cabinet/03-screen.png](../design/reference-v3/screenshots/4-cabinet/03-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
