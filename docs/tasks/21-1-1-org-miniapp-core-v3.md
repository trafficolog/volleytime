---
id: '21.1.1'
phase: '21'
epic: '21.1'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: ''
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['19.1.2', '20.1.2', '20.2.1']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: ''
  screens:
    [
      '3-miniapp-organizer/01-screen.png',
      '3-miniapp-organizer/02-screen.png',
      '3-miniapp-organizer/03-screen.png',
      '3-miniapp-organizer/04-screen.png',
    ]
tags: [reference-v3]
---

# Task 21.1.1: Mini App организатора v3: главная, состав, платежи, касса

## Цель

Перенести существующие экраны организатора в Mini App на v3 с учётом мест, баланса и статусной модели.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Mini App организатора v2 (8.10.2): главная, события, manage, payments, cashbox, members, invite, plans, settings, audit.
- **Дельта до референса:** Визуал v3, места и баланс событий, единые функции подсчёта (`pendingOf`, `buildRoster`).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Главная: бенто (касса-hero, баланс событий, «ждут подтверждения», события, быстрые действия)
2. Состав события: вкладки Состав / Платежи / Шеринг, «+N», для split — прогноз и «Закрыть запись и распределить»
3. Ожидают подтверждения
4. Касса
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Совпадение с `3-miniapp-organizer/01–04` по отчёту 19.0.2
- ✅ Деньги и счётчики берутся из тех же функций, что в кабинете
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-organizer/01-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/01-screen.png), [3-miniapp-organizer/02-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/02-screen.png), [3-miniapp-organizer/03-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/03-screen.png), [3-miniapp-organizer/04-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/04-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-organizer.jsx`, `docs/design/reference-v3/handoff/screens-contributions.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
