---
id: '25.1.2'
phase: '25'
epic: '25.1'
status: todo
release: 'v0.6.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-17'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, BACK]
depends_on: ['20.3.2', '23.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-17-self-check.md'
  screens: ['9.3-self-check']
tags: [reference-v3]
---

# Task 25.1.2: Самооценка (`M-17`)

## Цель

Короткая оценка своей игры после события.

## Контекст

- Спецификация референса: [M-17 · Самооценка](../design/reference-v3/specs/02-mini-app/M-17-self-check.md); макет: 9.3 Самооценка.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Форма на 30 секунд, входящие, напоминание.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12 → 23.1.1](23-1-1-player-features.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-03 → 23.2.1](23-2-1-home-feed.md), [M-12 → 23.2.3](23-2-3-profile-features.md), [P-09 → 20.3.2](20-3-2-bot-notifications.md), [P-14 → 23.1.2](23-1-2-feature-analytics.md), [M-15b → 26.1.4](26-1-4-ai-coach-ui.md), [M-16 → 25.1.1](25-1-1-warmup.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-20 → 25.1.4](25-1-4-streaks.md), [M-21 → 26.1.1](26-1-1-mvp-vote.md), [M-22 → 26.1.5](26-1-5-season-wrapped.md). [Подробнее](../design/reference-v3/specs/links.md#features)
- **Уведомления** — Бот, лента Mini App и лента кабинета — один источник. С этим связаны: [P-09 → 20.3.2](20-3-2-bot-notifications.md), [P-16 → 20.3.3](20-3-3-telegram-bot.md), [W-15 → 21.2.9](21-2-9-notifications.md), [M-13 → 20.4.9](20-4-9-player-screens.md). [Подробнее](../design/reference-v3/specs/links.md#notify)
- **Самооценка → прогресс → составы → тренер** — Данные самооценки питают прогресс, балансировку и план тренера. С этим связаны: [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-15a → 26.1.3](26-1-3-ai-coach-agent.md). [Подробнее](../design/reference-v3/specs/links.md#skill-chain)

## Что должно быть сделано

1. Форма на 30 секунд
2. Входящие неотвеченные
3. Напоминание
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Форма доступна до следующей игры
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [9.3-self-check](../design/reference-v3/screenshots/9.3-self-check) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/idea-app.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-a.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-b.jsx`, `docs/design/reference-v3/handoff/screens-ideas-future.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
