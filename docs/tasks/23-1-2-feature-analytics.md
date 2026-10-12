---
id: '23.1.2'
phase: '23'
epic: '23.1'
status: todo
release: 'v0.5.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-14'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [BACK]
depends_on: ['23.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-14-feature-analytics.md'
  screens: []
tags: [reference-v3]
---

# Task 23.1.2: Аналитика гипотез (`P-14`)

## Цель

Данные, чтобы решать судьбу каждой гипотезы.

## Контекст

- Спецификация референса: [P-14 · Аналитика гипотез](../design/reference-v3/specs/01-platform/P-14-feature-analytics.md); макет: 9 Гипотезы для игроков.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Трекинг-события, доли выключивших, удержание; метрика успеха на гипотезу.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12 → 23.1.1](23-1-1-player-features.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-03 → 23.2.1](23-2-1-home-feed.md), [M-12 → 23.2.3](23-2-3-profile-features.md), [P-09 → 20.3.2](20-3-2-bot-notifications.md), [M-15b → 26.1.4](26-1-4-ai-coach-ui.md), [M-16 → 25.1.1](25-1-1-warmup.md), [M-17 → 25.1.2](25-1-2-self-check.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-20 → 25.1.4](25-1-4-streaks.md), [M-21 → 26.1.1](26-1-1-mvp-vote.md), [M-22 → 26.1.5](26-1-5-season-wrapped.md). [Подробнее](../design/reference-v3/specs/links.md#features)

## Что должно быть сделано

1. События открытия и использования каждой функции
2. Доля игроков, выключивших функцию
3. Удержание и частота записей у пользователей функции и без неё
4. Данные и API: Трекинг-события, дашборд.

## Критерии приёмки

- ✅ Для каждой гипотезы есть метрика успеха и отчёт
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
