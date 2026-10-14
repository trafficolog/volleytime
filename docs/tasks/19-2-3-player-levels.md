---
id: '19.2.3'
phase: '19'
epic: '19.2'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-14
status_note: 'PR #117 (f53697f), ревью standard — merge без Critical/Important, CI зелёный. Остаток A/B/C на dev-витрине /dev/atoms убран в follow-up.'
ref_id: 'P-10'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [BACK, DB]
depends_on: ['19.2.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-10-player-levels.md'
  screens: []
tags: [reference-v3]
---

# Task 19.2.3: Уровни В1–В4+ (`P-10`)

## Цель

Единая шкала уровней вместо A/B/C.

## Контекст

- Спецификация референса: [P-10 · Уровни В1–В4+](../design/reference-v3/specs/01-platform/P-10-player-levels.md); макет: 4 Кабинет → Страница группы → уровни.
- **Как есть (main `e68acf2`):** `organization_members.ratingInOrg` (целое число), A/B/C в макетах v2.
- **Дельта до референса:** Справочник уровней с описаниями, уровень игрока, группы (несколько) и события; миграция существующих значений.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Уровни В1–В4+** — Один справочник для игроков, групп, составов и SEO. С этим связаны: [M-14 → 20.4.10](20-4-10-player-level.md), [W-06 → 21.2.2](21-2-2-players.md), [M-24 → 21.1.3](21-1-3-org-players-report.md), [W-13 → 24.1.1](24-1-1-group-page-builder.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-15a → 26.1.3](26-1-3-ai-coach-agent.md). [Подробнее](../design/reference-v3/specs/links.md#levels)

## Что должно быть сделано

1. Справочник: В1 полупрофи, В2 сильный любительский, В3 средний любительский, В4 продолжающие любители, В4+ начинающие — с описаниями
2. Миграция существующих данных с A/B/C
3. Уровень у игрока, группы (несколько), события
4. Данные и API: GET /levels; Поле level в профиле игрока.

## Критерии приёмки

- ✅ В интерфейсе нигде не осталось A/B/C
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
