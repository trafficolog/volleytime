---
id: '15.3'
phase: '15'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: 'Напоминания 24h + 2h confirmed-игрокам. Idempotent.'
estimated_hours: '3-4'
depends_on: ['15.2', '8.4']
---

# Epic 15.3: Reminders 24h + 2h + idempotency

**Цель.** Обработчики reminder_24h и reminder_2h: разослать напоминания confirmed-игрокам события через notifier. Idempotent (не слать дважды).

## Контекст

Решение 3: 24ч + 2ч, только confirmed. Обработчик загружает событие + confirmed-брони, шлёт каждому напоминание. Должен быть idempotent (повтор задачи не дублирует уведомление) и проверять актуальность (событие не отменено).

## Definition of Done

- reminder_24h handler: confirmed игрокам «напоминание: тренировка завтра»
- reminder_2h handler: confirmed игрокам «через 2 часа» (финальное)
- Только confirmed (не waitlisted/cancelled/pending)
- Проверка: событие не cancelled (иначе пропуск)
- Idempotent: отметка что напоминание отправлено (не слать повторно при retry задачи)
- Через notifier (8.4) — шаблоны reminder_24h/reminder_2h
- Уведомление с кнопкой открыть событие

## Задачи

| ID     | Задача                                                 | Часов |
| ------ | ------------------------------------------------------ | ----: |
| 15.3.1 | reminder handlers (24h, 2h) + шаблоны                  |     2 |
| 15.3.2 | Idempotency (отметка отправки) + проверка актуальности |   1-2 |

## Не делать

- ❌ Не слать waitlisted/cancelled
- ❌ Не слать для отменённого события
- ❌ Не слать дважды (idempotency)
- ❌ Не делать настраиваемые пороги (фиксировано)
