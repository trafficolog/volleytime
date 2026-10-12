---
id: '20.4.7'
phase: '20'
epic: '20.4'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-08'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['20.1.3', '19.0.3']
supersedes: []
decisions: ['D-06']
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-08-invite-booking.md'
  screens: ['3-miniapp-player/07-screen.png']
tags: [reference-v3]
---

# Task 20.4.7: Запись по приглашению в Mini App (`M-08`)

## Цель

Событие с записью по приглашению в Mini App.

## Контекст

- Спецификация референса: [M-08 · Запись по приглашению](../design/reference-v3/specs/02-mini-app/M-08-invite-booking.md); макет: 4 Кабинет → Создание события → Запись (в Mini App пока нет).
- **Как есть (main `e68acf2`):** Экран приглашения в группу `/m/invite/[token]` (8.10.6).
- **Дельта до референса:** Бейдж «по приглашению», «Запросить приглашение» и статус запроса, вход по ссылке сразу в событие, просроченная ссылка. Состояния не нарисованы в референсе — старт только после D-06.
- Решения владельца (2026-10-12): [D-06](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-06) — исполнитель собирает 4 состояния из атомов v3 и прикладывает скриншоты; владелец утверждает до merge.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [W-11 → 20.5.7](20-5-7-settings.md), [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [P-16 → 20.3.3](20-3-3-telegram-bot.md), [W-14 → 24.1.2](24-1-2-group-page-render.md). [Подробнее](../design/reference-v3/specs/links.md#invite)

## Что должно быть сделано

1. Бейдж «по приглашению»
2. Кнопка «Запросить приглашение» и статус запроса
3. Вход по ссылке-приглашению сразу в событие
4. Состояния экрана: Без приглашения; Запрос отправлен; Приглашение принято; Ссылка просрочена.
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Состояния нарисованы в макете до разработки
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-player/07-screen.png](../design/reference-v3/screenshots/3-miniapp-player/07-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
