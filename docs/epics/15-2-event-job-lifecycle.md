---
id: '15.2'
phase: '15'
status: superseded
sync_state: drifted
last_reviewed: 2026-10-12
status_note: 'Поглощён задачей 20.3.1 (референс v3).'
estimated_hours: '3-4'
depends_on: ['15.1', '5.2']
superseded_by: '20.3.1'
---

# Epic 15.2: Регистрация/отмена задач Event (lifecycle)

**Цель.** При создании Event регистрировать scheduled-задачи (reminder 24h, reminder 2h+close, auto-finish). При отмене/изменении — снимать/перерегистрировать. Idempotent.

## Контекст

Задачи привязаны к времени события (startsAt/endsAt). create → schedule; cancel → отмена; изменение времени → перерегистрация. Без утечек (отменённое событие не должно слать напоминания).

## Definition of Done

- eventService.create → schedule jobs: reminder_24h (startsAt−24ч), reminder_2h (startsAt−2ч), auto_finish (endsAt+30мин)
- eventService.cancel → отмена всех задач события
- Изменение startsAt/endsAt → перерегистрация (старые сняты, новые по новому времени)
- Задачи в прошлом не регистрируются (если событие <24ч — только применимые)
- jobKey по eventId+type (для отмены/дедупликации)
- Idempotent (повторная регистрация не дублирует)

## Задачи

| ID     | Задача                                   | Часов |
| ------ | ---------------------------------------- | ----: |
| 15.2.1 | Регистрация задач в eventService.create  |   1-2 |
| 15.2.2 | Отмена/перерегистрация при cancel/update |   1-2 |

## Не делать

- ❌ Не оставлять задачи отменённого события (утечка напоминаний)
- ❌ Не регистрировать задачи в прошлом
- ❌ Не дублировать при повторной регистрации
