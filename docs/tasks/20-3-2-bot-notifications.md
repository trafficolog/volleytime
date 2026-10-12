---
id: '20.3.2'
phase: '20'
epic: '20.3'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-09'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [BACK]
depends_on: ['20.3.1']
supersedes: ['15.7.1', '15.7.2']
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-09-bot-notifications.md'
  screens: ['2-bot', '3-miniapp-player/11-screen.png']
tags: [reference-v3]
---

# Task 20.3.2: Уведомления через бота и лента (`P-09`)

## Цель

Своевременные сообщения игрокам и организаторам.

## Контекст

- Спецификация референса: [P-09 · Уведомления через бота](../design/reference-v3/specs/01-platform/P-09-bot-notifications.md); макет: 2 Telegram Bot; 3 Mini App → Уведомления.
- **Как есть (main `e68acf2`):** Notifier (8.4) отправляет сообщения сразу после действий (booking, payment, split, waitlist), без хранения и без очереди.
- **Дельта до референса:** Хранимая лента уведомлений (один источник для бота, Mini App и кабинета), очередь отправки с лимитами Bot API, дедупликация «один тип на событие», тихие часы, типы из P-09.
- Поглощает карточки (входные материалы, читать перед реализацией): [15.7.1](15-7-1-notify-deliver-job.md), [15.7.2](15-7-2-route-critical.md).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12 → 23.1.1](23-1-1-player-features.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-03 → 23.2.1](23-2-1-home-feed.md), [M-12 → 23.2.3](23-2-3-profile-features.md), [P-14 → 23.1.2](23-1-2-feature-analytics.md), [M-15b → 26.1.4](26-1-4-ai-coach-ui.md), [M-16 → 25.1.1](25-1-1-warmup.md), [M-17 → 25.1.2](25-1-2-self-check.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-20 → 25.1.4](25-1-4-streaks.md), [M-21 → 26.1.1](26-1-1-mvp-vote.md), [M-22 → 26.1.5](26-1-5-season-wrapped.md). [Подробнее](../design/reference-v3/specs/links.md#features)
- **Уведомления** — Бот, лента Mini App и лента кабинета — один источник. С этим связаны: [P-16 → 20.3.3](20-3-3-telegram-bot.md), [W-15 → 21.2.9](21-2-9-notifications.md), [M-13 → 20.4.9](20-4-9-player-screens.md), [M-17 → 25.1.2](25-1-2-self-check.md). [Подробнее](../design/reference-v3/specs/links.md#notify)

## Что должно быть сделано

1. Типы: запись открыта, место из очереди, напоминание, итоговая цена сбора, оплата, составы, MVP
2. Тихие часы
3. Не отправлять уведомления по функциям, выключенным игроком (после P-12)
4. Данные и API: Шаблоны сообщений; Очередь отправки с учётом лимитов Bot API.
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Не больше одного уведомления одного типа на событие
- ✅ Отключённые типы не приходят
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [2-bot](../design/reference-v3/screenshots/2-bot), [3-miniapp-player/11-screen.png](../design/reference-v3/screenshots/3-miniapp-player/11-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-bot.jsx`, `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
