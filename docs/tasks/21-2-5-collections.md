---
id: '21.2.5'
phase: '21'
epic: '21.2'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'W-08'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['21.2.4']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-08-collections.md'
  screens: ['4-cabinet/11-screen.png', '4-cabinet/12-screen.png']
tags: [reference-v3]
---

# Task 21.2.5: Сборы в кабинете (`W-08`)

## Цель

Сборы денег вне событий.

## Контекст

- Спецификация референса: [W-08 · Сборы](../design/reference-v3/specs/03-organizer-web/W-08-collections.md); макет: 4 Кабинет организатора → Сборы.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Список и форма «Новый сбор» на API 21.2.4.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Список
2. Форма «Новый сбор»
3. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Сбор виден игрокам в Mini App
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/11-screen.png](../design/reference-v3/screenshots/4-cabinet/11-screen.png), [4-cabinet/12-screen.png](../design/reference-v3/screenshots/4-cabinet/12-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
