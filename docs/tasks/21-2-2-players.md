---
id: '21.2.2'
phase: '21'
epic: '21.2'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'W-06'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.2.3']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-06-players.md'
  screens: ['4-cabinet/06-screen.png']
tags: [reference-v3]
---

# Task 21.2.2: Игроки в кабинете (`W-06`)

## Цель

База игроков группы.

## Контекст

- Спецификация референса: [W-06 · Игроки](../design/reference-v3/specs/03-organizer-web/W-06-players.md); макет: 4 Кабинет организатора → Игроки.
- **Как есть (main `e68acf2`):** Страница участников с модерацией (4.7.3, 4.9.8).
- **Дельта до референса:** Уровни В1–В4+, фильтры, карточка игрока.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Уровни В1–В4+** — Один справочник для игроков, групп, составов и SEO. С этим связаны: [P-10 → 19.2.3](19-2-3-player-levels.md), [M-14 → 20.4.10](20-4-10-player-level.md), [M-24 → 21.1.3](21-1-3-org-players-report.md), [W-13 → 24.1.1](24-1-1-group-page-builder.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-15a → 26.1.3](26-1-3-ai-coach-agent.md). [Подробнее](../design/reference-v3/specs/links.md#levels)
- **Игроки и отчёты** — Одни цифры в кабинете и в Mini App организатора. С этим связаны: [W-10 → 21.2.7](21-2-7-reports.md), [W-07 → 21.2.3](21-2-3-cashbox.md), [M-24 → 21.1.3](21-1-3-org-players-report.md). [Подробнее](../design/reference-v3/specs/links.md#reports)

## Что должно быть сделано

1. Список
2. Уровни В1–В4+
3. Фильтры
4. Карточка игрока
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Нет A/B/C
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/06-screen.png](../design/reference-v3/screenshots/4-cabinet/06-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
