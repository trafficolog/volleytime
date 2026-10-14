---
id: '21.2'
phase: '21'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
estimated_hours: '40-80'
depends_on: ['19.2.1', '19.2.2', '19.2.3', '19.3.1', '20.2.1', '20.3.2', '20.5.4', '20.5.8']
---

# Epic 21.2: Кабинет: разделы

**Цель.** Обзор, игроки, касса, сборы, абонементы, отчёты, баланс, уведомления.

## Контекст

Фаза [21](../phases/21-organizer-mvp-v3.md) · релиз `v0.3.0` · референс Ф2 (без Root Admin). Порядок внутри эпика — по `depends_on` карточек; задачи без взаимных зависимостей идут параллельно (см. [ORCHESTRATION](../ORCHESTRATION.md)).

## Definition of Done

- Все задачи эпика `done`, ревью и CI пройдены.
- UI-задачи приложили отчёт визуальной сверки с референсом.

## Задачи

| ID                                                  | Задача                                      | Референс | Сложн. | Реализация          | Ревью               |
| --------------------------------------------------- | ------------------------------------------- | -------- | ------ | ------------------- | ------------------- |
| [21.2.1](../tasks/21-2-1-overview.md)               | Обзор кабинета v3                           | W-02     | S      | `claude-haiku-5-5`  | `claude-sonnet-5-5` |
| [21.2.2](../tasks/21-2-2-players.md)                | Игроки в кабинете                           | W-06     | M      | `claude-sonnet-5-5` | `claude-sonnet-5-5` |
| [21.2.3](../tasks/21-2-3-cashbox.md)                | Касса кабинета v3                           | W-07     | M      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [21.2.4](../tasks/21-2-4-collections-domain.md)     | Сборы: домен, API и касса                   | —        | L      | `claude-opus-5-5`   | `claude-opus-5-5`   |
| [21.2.5](../tasks/21-2-5-collections.md)            | Сборы в кабинете                            | W-08     | M      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [21.2.6](../tasks/21-2-6-subscriptions.md)          | Абонементы в кабинете v3                    | W-09     | M      | `claude-sonnet-5-5` | `claude-sonnet-5-5` |
| [21.2.7](../tasks/21-2-7-reports.md)                | Отчёты и экспорт                            | W-10     | M      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [21.2.8](../tasks/21-2-8-balance-billing.md)        | Баланс событий и оплата в кабинете          | W-12     | M      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [21.2.9](../tasks/21-2-9-notifications.md)          | Уведомления кабинета                        | W-15     | S      | `claude-haiku-5-5`  | `claude-sonnet-5-5` |
| [21.2.10](../tasks/21-2-10-events-search-export.md) | Поиск, фильтры, экспорт и пагинация событий | —        | M      | `claude-sonnet-5-5` | `claude-opus-5-5`   |

## Не делать

- ❌ Не начинать задачу с открытыми `depends_on` или решениями владельца.
