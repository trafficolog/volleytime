---
id: '25.1.3'
phase: '25'
epic: '25.1'
status: todo
release: 'v0.6.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-18'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['25.1.2', '19.2.3']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-18-skill-progress.md'
  screens: ['9.4-progress']
tags: [reference-v3]
---

# Task 25.1.3: Прогресс навыков (`M-18`)

## Цель

Видно, как растут навыки.

## Контекст

- Спецификация референса: [M-18 · Прогресс навыков](../design/reference-v3/specs/02-mini-app/M-18-skill-progress.md); макет: 9.4 Прогресс.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Радар 6 навыков, сравнение периодов, путь до уровня.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Уровни В1–В4+** — Один справочник для игроков, групп, составов и SEO. С этим связаны: [P-10 → 19.2.3](19-2-3-player-levels.md), [M-14 → 20.4.10](20-4-10-player-level.md), [W-06 → 21.2.2](21-2-2-players.md), [M-24 → 21.1.3](21-1-3-org-players-report.md), [W-13 → 24.1.1](24-1-1-group-page-builder.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-15a → 26.1.3](26-1-3-ai-coach-agent.md). [Подробнее](../design/reference-v3/specs/links.md#levels)
- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12 → 23.1.1](23-1-1-player-features.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-03 → 23.2.1](23-2-1-home-feed.md), [M-12 → 23.2.3](23-2-3-profile-features.md), [P-09 → 20.3.2](20-3-2-bot-notifications.md), [P-14 → 23.1.2](23-1-2-feature-analytics.md), [M-15b → 26.1.4](26-1-4-ai-coach-ui.md), [M-16 → 25.1.1](25-1-1-warmup.md), [M-17 → 25.1.2](25-1-2-self-check.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-20 → 25.1.4](25-1-4-streaks.md), [M-21 → 26.1.1](26-1-1-mvp-vote.md), [M-22 → 26.1.5](26-1-5-season-wrapped.md). [Подробнее](../design/reference-v3/specs/links.md#features)
- **Самооценка → прогресс → составы → тренер** — Данные самооценки питают прогресс, балансировку и план тренера. С этим связаны: [M-17 → 25.1.2](25-1-2-self-check.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-15a → 26.1.3](26-1-3-ai-coach-agent.md). [Подробнее](../design/reference-v3/specs/links.md#skill-chain)

## Что должно быть сделано

1. Радар 6 навыков
2. Сравнение периодов
3. Путь до следующего уровня
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Меньше 3 оценок — пустое состояние с пояснением
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [9.4-progress](../design/reference-v3/screenshots/9.4-progress) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/idea-app.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-a.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-b.jsx`, `docs/design/reference-v3/handoff/screens-ideas-future.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
