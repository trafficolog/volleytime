---
id: '21.1.3'
phase: '21'
epic: '21.1'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-24'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.2.3', '21.2.7']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-24-org-players-report.md'
  screens: ['3-miniapp-organizer/12-screen.png', '3-miniapp-organizer/13-screen.png']
tags: [reference-v3]
---

# Task 21.1.3: Mini App организатора: игроки и отчёт за месяц (`M-24`)

## Цель

Короткая сводка группы в Mini App.

## Контекст

- Спецификация референса: [M-24 · Организатор · игроки и отчёт](../design/reference-v3/specs/02-mini-app/M-24-org-players-report.md); макет: 3 Mini App → режим организатора → Игроки, Отчёт.
- **Как есть (main `e68acf2`):** Список участников с модерацией (8.10.2).
- **Дельта до референса:** Вкладки Активные / Заявки / Все, уровни, отчёт за месяц с цифрами из 21.2.7.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Уровни В1–В4+** — Один справочник для игроков, групп, составов и SEO. С этим связаны: [P-10 → 19.2.3](19-2-3-player-levels.md), [M-14 → 20.4.10](20-4-10-player-level.md), [W-06 → 21.2.2](21-2-2-players.md), [W-13 → 24.1.1](24-1-1-group-page-builder.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-15a → 26.1.3](26-1-3-ai-coach-agent.md). [Подробнее](../design/reference-v3/specs/links.md#levels)
- **Игроки и отчёты** — Одни цифры в кабинете и в Mini App организатора. С этим связаны: [W-06 → 21.2.2](21-2-2-players.md), [W-10 → 21.2.7](21-2-7-reports.md), [W-07 → 21.2.3](21-2-3-cashbox.md). [Подробнее](../design/reference-v3/specs/links.md#reports)

## Что должно быть сделано

1. Игроки с уровнями
2. Отчёт за месяц: события, посещаемость, деньги
3. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Цифры совпадают с W-10
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-organizer/12-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/12-screen.png), [3-miniapp-organizer/13-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/13-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-organizer.jsx`, `docs/design/reference-v3/handoff/screens-contributions.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
