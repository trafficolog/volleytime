---
id: '15.8'
phase: '15'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: 'Тесты scheduler с freeze time.'
estimated_hours: '3-4'
depends_on: ['15.3', '15.4', '15.5', '15.6', '15.7']
---

# Epic 15.8: Tests (freeze time)

**Цель.** Тесты планировщика: регистрация/отмена задач, reminders (idempotent), auto-close/finish, waitlist confirm-flow, TTL, очередь с retry. Управление временем (freeze/advance).

## Контекст

Time-based логику тестировать без реального ожидания — через freeze time (vitest fake timers / контроль now). Проверять что задачи срабатывают в правильный момент и идемпотентны.

## Definition of Done

- Регистрация задач при create (24h/2h/finish с правильным временем)
- Отмена задач при cancel (нет утечек)
- Reminders: confirmed получают, idempotent (повтор не дублирует), cancelled событие пропускается
- Auto-close: за 2ч → closed → book отклоняется
- Auto-finish: finished через 30мин
- Waitlist confirm-flow: offer → confirm → в состав; offer → TTL истёк → следующий; FIFO
- TTL pending: online отменяется, cash НЕ трогается
- Notify retry: сбой → повтор; исчерпание → лог
- Freeze time (fake timers / инъекция now)
- ≥ 6 тестов

## Задачи

| ID     | Задача                                              | Часов |
| ------ | --------------------------------------------------- | ----: |
| 15.8.1 | Job lifecycle + reminders + auto-close/finish tests |   1-2 |
| 15.8.2 | Waitlist confirm-flow + TTL + notify retry tests    |   1-2 |

## Не делать

- ❌ Не ждать реального времени (freeze)
- ❌ Не делать E2E HTTP
- ❌ Не тестировать сам pg-boss (наша логика)
