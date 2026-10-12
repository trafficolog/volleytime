---
id: '24.1.4'
phase: '24'
epic: '24.1'
status: todo
release: 'v0.5.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['19.1.1', '21.2.8']
supersedes: []
decisions: ['D-10', 'D-11']
estimated_hours: '4-8'
reference:
  spec: ''
  screens: ['0-landing']
tags: [reference-v3]
---

# Task 24.1.4: Лендинг v3

## Цель

Обновить публичный лендинг до референса v3.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Лендинг v2 (3.11.4, 3.11.7, 3.11.8).
- **Дельта до референса:** Новый знак, токены, тексты и блоки v3.
- Зависит от решений владельца: [D-10](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-10), [D-11](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-11). До решения карточка не стартует.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Дельта `0 Лендинг.html` и `landing-fx.js` v3 относительно реализации 3.11.4/3.11.7
2. Блок тарифов на баланс событий — по D-11, только при работающей покупке 21.2.8
3. Доступность и reduced-motion (3.11.5) сохраняются
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Совпадение с `0-landing` по отчёту 19.0.2
- ✅ Нет обещаний функций, которых нет в production
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [0-landing](../design/reference-v3/screenshots/0-landing) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/0 Лендинг.html`, `docs/design/reference-v3/handoff/landing-fx.js`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
