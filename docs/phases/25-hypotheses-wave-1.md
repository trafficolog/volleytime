---
id: '25'
status: todo
release: 'v0.6.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: 'Референс v3 Ф5. 5 задач.'
estimated_hours: '24-48'
depends_on: []
---

# Phase 25: Гипотезы · волна 1

**Цель.** Дешёвые гипотезы без LLM за флагами: разминка, самооценка, прогресс, серии.

## Контекст

Каждая гипотеза за флагом P-12, решение по метрикам P-14. Статус handoff: «гипотезы, не MVP» — старт только после решения владельца.

Источник — референс v3 (Ф5), импорт в [docs/design/reference-v3](../design/reference-v3/README.md); перепланирование — [19.0.1](../tasks/19-0-1-reference-v3-replan.md).

## Definition of Done

1. Гипотезы волны 1 за флагами в production
2. Решения по каждой гипотезе записаны (25.1.5)

## Эпики

| ID                                         | Эпик             | Задач | Часов |
| ------------------------------------------ | ---------------- | ----: | ----: |
| [25.1](../epics/25-1-hypotheses-wave-1.md) | Гипотезы волны 1 |     5 | 24-48 |

**Итого:** 1 эпиков, 5 задач, 24-48 ч. Модели реализации: `claude-opus-5-5` — 1, `claude-sonnet-5-5` — 4.

## Технические заметки

### Что НЕ делаем в этой фазе

- ❌ LLM-функции — фаза 26

### Открытые вопросы

- Решения владельца: [журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md).

## Ссылки

- [ROADMAP.md](../ROADMAP.md)
- [RELEASES.md](../RELEASES.md)
- [ORCHESTRATION.md](../ORCHESTRATION.md)
