---
id: '19.1.3'
phase: '19'
epic: '19.1'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: ['1-brand']
tags: [reference-v3]
---

# Task 19.1.3: Атомы v3: select, toggle, popover, alert, toast, сегменты

## Цель

Перенести изменённые и новые атомы бренд-системы v3 как Vue-компоненты.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Атомы v2 (3.11.2): `components/vt/*` — Avatar, Chip, Icon, Meter, MiniHeader, Sheet, TabBar.
- **Дельта до референса:** В `atoms.jsx`/`brand.jsx` v3 добавлены select, toggle, popover, alert, toast и паттерны гипотез; Sheet и TabBar изменены.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. `VtSelect` (свой выпадающий список, не нативный), Toggle 36×20, Popover (веб, 210px), Alert (до 360px), Toast (капсула над доком, 2.4 с), Action sheet (подъём 180 мс)
2. Сегмент-пилюля `WSeg`, сегментная шкала мест, чипы выбора
3. Доступность: focus-visible, зона нажатия ≥ 44×44, `prefers-reduced-motion`
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Компоненты покрыты interaction-тестами
- ✅ Совпадение с разделом «Компоненты» в `1 Brand and System` по отчёту 19.0.2
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [1-brand](../design/reference-v3/screenshots/1-brand) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/brand.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`, `docs/design/reference-v3/handoff/styles.css`, `docs/design/reference-v3/handoff/brand-ideas.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
