---
id: '26.1'
phase: '26'
status: todo
release: 'v0.7.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
estimated_hours: '52-104'
depends_on: ['19.2.3', '19.3.1', '23.1.1', '23.1.2', '25.1.2']
---

# Epic 26.1: Гипотезы волны 2

**Цель.** MVP, составы, AI-тренер, итоги сезона.

## Контекст

Фаза [26](../phases/26-hypotheses-wave-2.md) · релиз `v0.7.0` · референс Ф6. Порядок внутри эпика — по `depends_on` карточек; задачи без взаимных зависимостей идут параллельно (см. [ORCHESTRATION](../ORCHESTRATION.md)).

## Definition of Done

- Все задачи эпика `done`, ревью и CI пройдены.
- UI-задачи приложили отчёт визуальной сверки с референсом.

## Задачи

| ID                                                   | Задача                                     | Референс | Сложн. | Реализация          | Ревью               |
| ---------------------------------------------------- | ------------------------------------------ | -------- | ------ | ------------------- | ------------------- |
| [26.1.1](../tasks/26-1-1-mvp-vote.md)                | MVP игры                                   | M-21     | M      | `claude-sonnet-5-5` | `claude-sonnet-5-5` |
| [26.1.2](../tasks/26-1-2-team-balancing.md)          | Составы на игру                            | M-19     | XL     | `claude-opus-5-5`   | `claude-opus-5-5`   |
| [26.1.3](../tasks/26-1-3-ai-coach-agent.md)          | AI-тренер: агент                           | M-15a    | XL     | `claude-opus-5-5`   | `claude-opus-5-5`   |
| [26.1.4](../tasks/26-1-4-ai-coach-ui.md)             | AI-тренер: экраны                          | M-15b    | L      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [26.1.5](../tasks/26-1-5-season-wrapped.md)          | Итоги сезона                               | M-22     | M      | `claude-sonnet-5-5` | `claude-sonnet-5-5` |
| [26.1.6](../tasks/26-1-6-release-v0-7-0-decision.md) | Релиз v0.7.0: решение по гипотезам волны 2 | —        | M      | `claude-opus-5-5`   | `claude-opus-5-5`   |

## Не делать

- ❌ Не начинать задачу с открытыми `depends_on` или решениями владельца.
