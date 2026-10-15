---
id: '20.4.10'
phase: '20'
epic: '20.4'
status: in_progress
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-15
status_note: 'Реализовано (review pending): уровень в профиле, в списке игроков с фильтром и в составе события (Mini App, только участникам группы). Кабинет: состав рендерит другой эндпоинт, чип там не выведен (вне объёма карточки). Публичная страница события уровней не показывает (решение владельца 2026-10-14). Визуальная сверка: docs/operations/qa/2026-10-14-20-4-10-player-level.md.'
ref_id: 'M-14'
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.2.3']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-14-player-level.md'
  screens: []
tags: [reference-v3]
---

# Task 20.4.10: Уровень игрока в Mini App (`M-14`)

## Цель

Шкала В1–В4+ в Mini App.

## Контекст

- Спецификация референса: [M-14 · Уровень игрока](../design/reference-v3/specs/02-mini-app/M-14-player-level.md); макет: 3 Mini App → Профиль, состав.
- **Как есть (main `e68acf2`):** Уровней нет.
- **Дельта до референса:** Уровень в профиле и составе, фильтр по уровню; нигде нет A/B/C.
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Уровни В1–В4+** — Один справочник для игроков, групп, составов и SEO. С этим связаны: [P-10 → 19.2.3](19-2-3-player-levels.md), [W-06 → 21.2.2](21-2-2-players.md), [M-24 → 21.1.3](21-1-3-org-players-report.md), [W-13 → 24.1.1](24-1-1-group-page-builder.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-15a → 26.1.3](26-1-3-ai-coach-agent.md). [Подробнее](../design/reference-v3/specs/links.md#levels)

## Что должно быть сделано

1. Уровень в профиле
2. Уровень в составе
3. Фильтр по уровню

## Критерии приёмки

- ✅ Нет A/B/C
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Haiku-задача: только вёрстка, тексты и переименования. Если нужна бизнес-логика — остановиться и эскалировать оркестратору.

## Решения владельца

- **2026-10-14:** уровни игроков в составе события («Состав») видят только участники группы (Mini App и кабинет). Публичная страница события уровней не показывает. Реализация: `publicRoster(..., { includeLevel: true })` только на маршруте участников; без опции ключа `level` в ответе нет. Журнал: [решения](../operations/decisions/2026-10-12-reference-v3-decisions.md).
- Маршрут `GET /api/organizations/{orgId}/events/{eventId}` остаётся `access: member` в IDOR-таблице; новых маршрутов нет.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
