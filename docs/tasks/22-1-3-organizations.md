---
id: '22.1.3'
phase: '22'
epic: '22.1'
status: todo
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'R-01'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, BACK]
depends_on: ['19.2.1', '22.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-01-organizations.md'
  screens:
    ['4b-root-admin/02-screen.png', '4b-root-admin/03-screen.png', '4b-root-admin/04-screen.png']
tags: [reference-v3]
---

# Task 22.1.3: Организации платформы (`R-01`)

## Цель

Управление организациями платформы.

## Контекст

- Спецификация референса: [R-01 · Организации](../design/reference-v3/specs/04-root-admin/R-01-organizations.md); макет: 7 Root Admin → Организации.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Список с фильтрами в URL, карточка, ручное создание, модули организации.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Список
2. Фильтры по кнопке
3. Ручное создание
4. Карточка
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Фильтры сохраняются в URL
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/02-screen.png](../design/reference-v3/screenshots/4b-root-admin/02-screen.png), [4b-root-admin/03-screen.png](../design/reference-v3/screenshots/4b-root-admin/03-screen.png), [4b-root-admin/04-screen.png](../design/reference-v3/screenshots/4b-root-admin/04-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
