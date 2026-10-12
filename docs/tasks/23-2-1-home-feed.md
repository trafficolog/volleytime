---
id: '23.2.1'
phase: '23'
epic: '23.2'
status: todo
release: 'v0.5.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-03'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['20.4.4', '23.1.1']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-03-home-feed.md'
  screens: ['9-ideas-overview']
tags: [reference-v3]
---

# Task 23.2.1: Главная «Лента дня» (`M-03`)

## Цель

Главная показывает игру и только те функции, которые игрок оставил.

## Контекст

- Спецификация референса: [M-03 · Главная «Лента дня»](../design/reference-v3/specs/02-mini-app/M-03-home-feed.md); макет: 3 Mini App → Главная; 9 Гипотезы → Вариант A.
- **Как есть (main `e68acf2`):** Главная v3 из 20.4.4.
- **Дельта до референса:** Блок «Сегодня» по флагам, чип серии, ссылка «Лишнее на главной?».
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12 → 23.1.1](23-1-1-player-features.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-12 → 23.2.3](23-2-3-profile-features.md), [P-09 → 20.3.2](20-3-2-bot-notifications.md), [P-14 → 23.1.2](23-1-2-feature-analytics.md), [M-15b → 26.1.4](26-1-4-ai-coach-ui.md), [M-16 → 25.1.1](25-1-1-warmup.md), [M-17 → 25.1.2](25-1-2-self-check.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-20 → 25.1.4](25-1-4-streaks.md), [M-21 → 26.1.1](26-1-1-mvp-vote.md), [M-22 → 26.1.5](26-1-5-season-wrapped.md). [Подробнее](../design/reference-v3/specs/links.md#features)
- **Разминка в событии** — Организатор включает разминку в событие, игрок видит и пропускает её. С этим связаны: [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [M-16 → 25.1.1](25-1-1-warmup.md). [Подробнее](../design/reference-v3/specs/links.md#warmup)

## Что должно быть сделано

1. Шапка: группа, чип серии, уведомления
2. Ближайшая игра (синий блок)
3. Плитки «Сессий осталось» (5 из 8) и «Мои записи» с шевроном
4. Блок «Сегодня»: составы, разминка, «После игры», неделя тренера, итоги сезона — по флагам
5. Расписание и «Смотреть все»
6. Ссылка «Лишнее на главной? Выключите в профиле»
7. Состояния экрана: Всё включено; Только игры (все флаги выкл.); Нет ближайшей игры; Нет абонемента.
8. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Выключение функции убирает её блок без перезагрузки
- ✅ В режиме «Только игры» нет пустых заголовков
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [9-ideas-overview](../design/reference-v3/screenshots/9-ideas-overview) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/idea-app.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-a.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-b.jsx`, `docs/design/reference-v3/handoff/screens-ideas-future.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
