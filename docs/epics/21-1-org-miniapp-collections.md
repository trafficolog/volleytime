---
id: '21.1'
phase: '21'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
estimated_hours: '40-80'
depends_on:
  [
    '19.1.2',
    '19.2.2',
    '19.2.3',
    '20.1.1',
    '20.1.2',
    '20.1.3',
    '20.2.1',
    '20.2.2',
    '20.3.2',
    '20.4.3',
    '20.4.8',
    '20.4.9',
    '20.5.5',
    '21.2.4',
    '21.2.7',
  ]
---

# Epic 21.1: Mini App: организатор и сборы

**Цель.** Режим организатора и сборы игрока по референсу.

## Контекст

Фаза [21](../phases/21-organizer-mvp-v3.md) · релиз `v0.3.0` · референс Ф2 (без Root Admin). Порядок внутри эпика — по `depends_on` карточек; задачи без взаимных зависимостей идут параллельно (см. [ORCHESTRATION](../ORCHESTRATION.md)).

## Definition of Done

- Все задачи эпика `done`, ревью и CI пройдены.
- UI-задачи приложили отчёт визуальной сверки с референсом.

## Задачи

| ID                                                                 | Задача                                                    | Референс | Сложн. | Реализация          | Ревью               |
| ------------------------------------------------------------------ | --------------------------------------------------------- | -------- | ------ | ------------------- | ------------------- |
| [21.1.1](../tasks/21-1-1-org-miniapp-core-v3.md)                   | Mini App организатора v3: главная, состав, платежи, касса | —        | L      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [21.1.2](../tasks/21-1-2-org-event-create.md)                      | Mini App организатора: создание события и серии           | M-23     | L      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [21.1.3](../tasks/21-1-3-org-players-report.md)                    | Mini App организатора: игроки и отчёт за месяц            | M-24     | M      | `claude-sonnet-5-5` | `claude-sonnet-5-5` |
| [21.1.4](../tasks/21-1-4-group-schedule.md)                        | Расписание группы на месяц (игрок и организатор)          | M-11     | M      | `claude-sonnet-5-5` | `claude-sonnet-5-5` |
| [21.1.5](../tasks/21-1-5-org-miniapp-collections-notifications.md) | Mini App организатора: сборы, уведомления                 | —        | M      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [21.1.6](../tasks/21-1-6-player-collections.md)                    | Сборы игрока: список, сбор, взнос                         | —        | M      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [21.1.7](../tasks/21-1-7-group-creation-wizard.md)                 | Мастер создания группы (3 шага)                           | —        | M      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [21.1.8](../tasks/21-1-8-player-payment-status-api.md)             | Статус оплаты в API игрока                                | —        | M      | `claude-sonnet-5-5` | `claude-sonnet-5-5` |

## Не делать

- ❌ Не начинать задачу с открытыми `depends_on` или решениями владельца.
