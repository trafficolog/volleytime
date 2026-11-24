---
id: '29.3'
phase: '29'
status: todo
release: 'v0.6.0'
sync_state: synced
last_reviewed: 2026-11-24
status_note: 'Перепланирование 19.0.5. Релиз v0.6.0 (D-34).'
estimated_hours: '28-56'
depends_on: ['29.1.1']
---

# Epic 29.3: Роли команды и обработка в Root Admin

**Цель.** Команда платформы работает по ролям; поддержка видит очередь, отвечает и настраивает темы, шаблоны и сроки.

## Контекст

Фаза [29](../phases/29-support-help-center.md). Порядок внутри эпика — по `depends_on` карточек; задачи без взаимных зависимостей идут параллельно (см. [ORCHESTRATION](../ORCHESTRATION.md)).

## Definition of Done

- Все задачи эпика `done`, ревью и CI пройдены.
- Контракты и тесты задач эпика приняты.

## Задачи

| ID                                               | Задача                                  | Референс | Сложн. | Реализация          | Ревью             |
| ------------------------------------------------ | --------------------------------------- | -------- | ------ | ------------------- | ----------------- |
| [29.3.1](../tasks/29-3-1-platform-team-roles.md) | Роли команды платформы                  | R-15     | L      | `claude-sonnet-5-5` | `claude-opus-5-5` |
| [29.3.2](../tasks/29-3-2-support-queue.md)       | Root Admin: очередь обращений           | R-12     | M      | `claude-sonnet-5-5` | `claude-opus-5-5` |
| [29.3.3](../tasks/29-3-3-support-ticket.md)      | Root Admin: карточка обращения          | R-13     | L      | `claude-sonnet-5-5` | `claude-opus-5-5` |
| [29.3.4](../tasks/29-3-4-support-settings.md)    | Root Admin: настройки поддержки         | R-14     | M      | `claude-sonnet-5-5` | `claude-opus-5-5` |
| [29.3.5](../tasks/29-3-5-moderation-appeal.md)   | Обращение из баннера модерации страницы | —        | M      | `claude-sonnet-5-5` | `claude-opus-5-5` |

## Не делать

- ❌ Не начинать задачу с открытыми `depends_on` или решениями владельца.
