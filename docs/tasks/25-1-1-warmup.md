---
id: '25.1.1'
phase: '25'
epic: '25.1'
status: todo
release: 'v0.6.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-16'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['20.5.5', '21.1.2', '23.1.1']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-16-warmup.md'
  screens: ['9.2-warmup']
tags: [reference-v3]
---

# Task 25.1.1: Разминка (`M-16`)

## Цель

Разминка перед игрой или в составе события.

## Контекст

- Спецификация референса: [M-16 · Разминка](../design/reference-v3/specs/02-mini-app/M-16-warmup.md); макет: 9.2 Разминка; 3 Mini App → Главная → карточка разминки.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Программы, таймер, разминка в составе события (поле в 20.5.5/21.1.2), пропуск виден организатору.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [W-02 → 21.2.1](21-2-1-overview.md), [P-03 → 20.1.1](20-1-1-pricing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [P-08 → 20.2.1](20-2-1-event-balance.md). [Подробнее](../design/reference-v3/specs/links.md#create-event)
- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12 → 23.1.1](23-1-1-player-features.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-03 → 23.2.1](23-2-1-home-feed.md), [M-12 → 23.2.3](23-2-3-profile-features.md), [P-09 → 20.3.2](20-3-2-bot-notifications.md), [P-14 → 23.1.2](23-1-2-feature-analytics.md), [M-15b → 26.1.4](26-1-4-ai-coach-ui.md), [M-17 → 25.1.2](25-1-2-self-check.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-20 → 25.1.4](25-1-4-streaks.md), [M-21 → 26.1.1](26-1-1-mvp-vote.md), [M-22 → 26.1.5](26-1-5-season-wrapped.md). [Подробнее](../design/reference-v3/specs/links.md#features)
- **Разминка в событии** — Организатор включает разминку в событие, игрок видит и пропускает её. С этим связаны: [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [M-03 → 23.2.1](23-2-1-home-feed.md). [Подробнее](../design/reference-v3/specs/links.md#warmup)

## Что должно быть сделано

1. Программы, предпросмотр, таймер, настройки
2. Разминка в составе события: карточка «Разминка входит в игру»
3. Пропуск одной кнопкой и отмена пропуска
4. Подсказка «можно прийти к …»
5. Состояния экрана: Своя до игры; В составе игры; Пропущена.
6. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Пропуск сохраняется и виден организатору
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [9.2-warmup](../design/reference-v3/screenshots/9.2-warmup) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/idea-app.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-a.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-b.jsx`, `docs/design/reference-v3/handoff/screens-ideas-future.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
