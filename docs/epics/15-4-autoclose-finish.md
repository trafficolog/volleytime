---
id: '15.4'
phase: '15'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: 'Авто-закрытие записи за 2ч + авто-finished через 30мин после.'
estimated_hours: '2-3'
depends_on: ['15.2', '5.2']
---

# Epic 15.4: Auto-close записи (2h) + auto-finished

**Цель.** За 2 ч до начала Event → статус closed (новые записи нельзя). Через 30 мин после окончания → finished (история/отчётность).

## Контекст

Решения 4, 8. Auto-close совмещён с reminder_2h (один момент). closed = новые записи запрещены; отмена регулируется cancellationDeadlineHours (Phase 5) отдельно. auto-finished убирает прошедшие из активных.

## Definition of Done

- reminder_2h handler также переводит Event published → closed
- closed: bookingService.book отклоняет (event_not_bookable)
- closed НЕ запрещает отмену (отмена — отдельный deadline Phase 5)
- auto_finish handler: closed/published → finished (через 30мин после endsAt)
- Idempotent (уже closed/finished → пропуск)
- Статусы согласованы с Phase 5 (event status enum)

## Задачи

| ID     | Задача                                          | Часов |
| ------ | ----------------------------------------------- | ----: |
| 15.4.1 | Auto-close (в reminder_2h) + блок новых записей |     1 |
| 15.4.2 | Auto-finished handler                           |     1 |

## Не делать

- ❌ Не запрещать отмену при closed (отдельный deadline Phase 5)
- ❌ Не трогать cancelled события
- ❌ Не делать настраиваемый порог close
