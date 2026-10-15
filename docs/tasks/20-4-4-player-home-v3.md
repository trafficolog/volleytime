---
id: '20.4.4'
phase: '20'
epic: '20.4'
status: in_progress
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-15
status_note: 'Реализовано, ревью ожидается (PR). Колокольчик уведомлений отложен до 20.4.9; «мои записи» — точный счётчик дашборда и маркер «ждут оплаты». Отчёт: docs/operations/qa/2026-10-15-20-4-4-player-home-visual.md'
ref_id: ''
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['19.1.2', '20.4.2']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: ''
  screens: ['3-miniapp-player/01-screen.png']
tags: [reference-v3]
---

# Task 20.4.4: Главная игрока v3 (без блоков гипотез)

## Цель

Перенести главную игрока на бенто v3: hero ближайшей записи, плитки, расписание — без функций гипотез (они в 23.2.1).

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Главная игрока v2 (8.10.1).
- **Дельта до референса:** Бенто-сетка v3, hero, плитки и статусная модель v3.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Шапка: группа (переключатель 20.4.3), уведомления
2. Hero ближайшей игры (blue-ink, «Иду», шкала мест на hero)
3. Плитки «Сессий осталось» и «Мои записи» с шевроном
4. Расписание и «Смотреть все» (→ 21.1.4)
5. Состояния: нет ближайшей игры, нет абонемента, офлайн
6. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Совпадение с `3-miniapp-player/01` по отчёту 19.0.2
- ✅ Статусы через компоненты 19.1.2
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-player/01-screen.png](../design/reference-v3/screenshots/3-miniapp-player/01-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
