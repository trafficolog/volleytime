---
id: '20.4.5'
phase: '20'
epic: '20.4'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-06'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['20.1.2', '19.1.2']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-06-event-booking.md'
  screens: ['3-miniapp-player/02-screen.png', '3-miniapp-player/03-screen.png']
tags: [reference-v3]
---

# Task 20.4.5: Событие и запись на несколько мест (`M-06`)

## Цель

Запись на событие с выбором числа мест.

## Контекст

- Спецификация референса: [M-06 · Событие и запись](../design/reference-v3/specs/02-mini-app/M-06-event-booking.md); макет: 3 Mini App → карточка события.
- **Как есть (main `e68acf2`):** Карточка события и запись на одно место со способом оплаты (8.10.1, 8.11.2).
- **Дельта до референса:** Выбор мест 1…maxSeats со степпером, ветка листа ожидания без оплаты, «+N» в составе, бронь 15 мин с пояснением.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Состав и запись** — Запись игрока и состав у организатора — одни и те же данные и статусы. С этим связаны: [P-05 → 20.1.2](20-1-2-multi-seat-booking.md), [M-05 → 19.1.2](19-1-2-booking-statuses.md), [M-09 → 20.4.8](20-4-8-cancel-booking.md), [W-05 → 20.5.6](20-5-6-event-card.md), [P-04 → 20.3.1](20-3-1-event-jobs.md). [Подробнее](../design/reference-v3/specs/links.md#booking)
- **Настройки группы** — Кабинет задаёт поведение Mini App. С этим связаны: [P-02 → 19.2.2](19-2-2-group-settings.md), [W-11 → 20.5.7](20-5-7-settings.md), [W-09 → 21.2.6](21-2-6-subscriptions.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-09 → 20.4.8](20-4-8-cancel-booking.md), [W-04 → 20.5.5](20-5-5-event-create.md). [Подробнее](../design/reference-v3/specs/links.md#settings)

## Что должно быть сделано

1. Карточка: время, место, цена, заполненность
2. Выбор мест 1…maxSeats
3. Состав с «+N» у игрока с несколькими местами
4. Лист ожидания и позиция
5. Оплата
6. Состояния экрана: Есть места; Мест нет — очередь; Я записан на N мест; Запись закрыта.
7. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Нельзя выбрать больше свободных мест без явного согласия на очередь
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-player/02-screen.png](../design/reference-v3/screenshots/3-miniapp-player/02-screen.png), [3-miniapp-player/03-screen.png](../design/reference-v3/screenshots/3-miniapp-player/03-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
