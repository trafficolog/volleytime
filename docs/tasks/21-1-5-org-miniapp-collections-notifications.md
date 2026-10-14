---
id: '21.1.5'
phase: '21'
epic: '21.1'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['21.2.4', '20.3.2', '20.4.3']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens:
    [
      '3-miniapp-organizer/06-screen.png',
      '3-miniapp-organizer/07-screen.png',
      '3-miniapp-organizer/08-screen.png',
      '3-miniapp-organizer/09-screen.png',
      '3-miniapp-organizer/11-screen.png',
    ]
tags: [reference-v3]
---

# Task 21.1.5: Mini App организатора: сборы, уведомления

## Цель

Экраны организатора, которых нет в списке задач референса, но которые нарисованы в Mini App.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Сборов и ленты нет (создание группы — [21.1.7](21-1-7-group-creation-wizard.md)).
- **Дельта до референса:** Новые экраны на домене 21.2.4 и ленте 20.3.2.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Сборы: список, управление сбором, новый сбор
2. Уведомления организатора (лента 20.3.2)
3. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Совпадение с `3-miniapp-organizer/06–09, 11` по отчёту 19.0.2
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-organizer/06-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/06-screen.png), [3-miniapp-organizer/07-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/07-screen.png), [3-miniapp-organizer/08-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/08-screen.png), [3-miniapp-organizer/09-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/09-screen.png), [3-miniapp-organizer/11-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/11-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-organizer.jsx`, `docs/design/reference-v3/handoff/screens-contributions.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
