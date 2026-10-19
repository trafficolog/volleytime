---
id: '26.1.1'
phase: '26'
epic: '26.1'
status: todo
release: 'v0.7.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-21'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, BACK]
depends_on: ['19.3.1', '23.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-21-mvp-vote.md'
  screens: ['9.7-mvp']
tags: [reference-v3]
---

# Task 26.1.1: MVP игры (`M-21`)

## Цель

Голосование за лучшего игрока.

## Контекст

- Спецификация референса: [M-21 · MVP игры](../design/reference-v3/specs/02-mini-app/M-21-mvp-vote.md); макет: 9.7 MVP.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Голосование до дедлайна, один голос, нельзя за себя, зал славы.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12 → 23.1.1](23-1-1-player-features.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-03 → 23.2.1](23-2-1-home-feed.md), [M-12 → 23.2.3](23-2-3-profile-features.md), [P-09 → 20.3.2](20-3-2-bot-notifications.md), [P-14 → 23.1.2](23-1-2-feature-analytics.md), [M-15b → 26.1.4](26-1-4-ai-coach-ui.md), [M-16 → 25.1.1](25-1-1-warmup.md), [M-17 → 25.1.2](25-1-2-self-check.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-20 → 25.1.4](25-1-4-streaks.md), [M-22 → 26.1.5](26-1-5-season-wrapped.md). [Подробнее](../design/reference-v3/specs/links.md#features)

## Что должно быть сделано

1. Голосование до дедлайна
2. Только участники игры, один голос
3. Зал славы
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Нельзя голосовать за себя
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [9.7-mvp](../design/reference-v3/screenshots/9.7-mvp) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/idea-app.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-a.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-b.jsx`, `docs/design/reference-v3/handoff/screens-ideas-future.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

- Уведомление этой функции (`mvp_vote`) строит эта карточка: значение enum `notification_type` и ключ `<тип>:event:<id>` заданы ADR, доставка — `enqueueNotification` из [20.3.2](20-3-2-bot-notifications.md) (решение владельца 2026-10-19)

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
