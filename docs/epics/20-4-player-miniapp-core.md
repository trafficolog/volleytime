---
id: '20.4'
phase: '20'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
estimated_hours: '44-88'
depends_on:
  [
    '19.0.3',
    '19.1.1',
    '19.1.2',
    '19.2.1',
    '19.2.2',
    '19.2.3',
    '19.3.1',
    '20.1.1',
    '20.1.2',
    '20.1.3',
    '20.3.2',
  ]
---

# Epic 20.4: Mini App игрока — ядро

**Цель.** Оболочка, навигация, главная, событие, запись, отмена, экраны игрока.

## Контекст

Фаза [20](../phases/20-booking-core-v3.md) · релиз `v0.2.0` · референс Ф1. Порядок внутри эпика — по `depends_on` карточек; задачи без взаимных зависимостей идут параллельно (см. [ORCHESTRATION](../ORCHESTRATION.md)).

## Definition of Done

- Все задачи эпика `done`, ревью и CI пройдены.
- UI-задачи приложили отчёт визуальной сверки с референсом.

## Задачи

| ID                                               | Задача                                                         | Референс | Сложн. | Реализация          | Ревью               |
| ------------------------------------------------ | -------------------------------------------------------------- | -------- | ------ | ------------------- | ------------------- |
| [20.4.1](../tasks/20-4-1-telegram-shell.md)      | Оболочка Telegram Mini App                                     | M-01     | M      | `claude-sonnet-5-5` | `claude-sonnet-5-5` |
| [20.4.2](../tasks/20-4-2-tab-bar.md)             | Таб-бар Mini App                                               | M-02     | S      | `claude-haiku-5-5`  | `claude-sonnet-5-5` |
| [20.4.3](../tasks/20-4-3-group-switcher.md)      | Переключатель групп                                            | M-04     | S      | `claude-haiku-5-5`  | `claude-sonnet-5-5` |
| [20.4.4](../tasks/20-4-4-player-home-v3.md)      | Главная игрока v3 (без блоков гипотез)                         | —        | L      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [20.4.5](../tasks/20-4-5-event-booking.md)       | Событие и запись на несколько мест                             | M-06     | L      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [20.4.6](../tasks/20-4-6-split-price-event.md)   | Событие со сбором суммой v3                                    | M-07     | L      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [20.4.7](../tasks/20-4-7-invite-booking.md)      | Запись по приглашению в Mini App                               | M-08     | M      | `claude-sonnet-5-5` | `claude-opus-5-5`   |
| [20.4.8](../tasks/20-4-8-cancel-booking.md)      | Отмена записи v3                                               | M-09     | S      | `claude-haiku-5-5`  | `claude-sonnet-5-5` |
| [20.4.9](../tasks/20-4-9-player-screens.md)      | Экраны игрока v3: абонементы, мои записи, уведомления, профиль | M-13     | M      | `claude-sonnet-5-5` | `claude-sonnet-5-5` |
| [20.4.10](../tasks/20-4-10-player-level.md)      | Уровень игрока в Mini App                                      | M-14     | S      | `claude-haiku-5-5`  | `claude-sonnet-5-5` |
| [20.4.11](../tasks/20-4-11-waitlist-position.md) | Позиция в листе ожидания                                       | —        | M      | `claude-sonnet-5-5` | `claude-opus-5-5`   |

## Не делать

- ❌ Не начинать задачу с открытыми `depends_on` или решениями владельца.
