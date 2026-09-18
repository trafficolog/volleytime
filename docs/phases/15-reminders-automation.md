---
id: '15'
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: 'Auto-reminders, TTL переходов, waitlist promotion с подтверждением.'
estimated_hours: '20-30'
depends_on: ['10']
---

# Phase 15: Reminders & Automation

**Цель.** Бот сам напоминает за 24 ч и за 2 ч до тренировки, закрывает запись, продвигает waitlist с TTL подтверждения, авто-finished для прошедших событий.

## Эпики

| ID   | Эпик                                                       | Задач |
| ---- | ---------------------------------------------------------- | ----: |
| 15.1 | Job runner setup (BullMQ или pg-boss — выбрать)            |     2 |
| 15.2 | Регистрация задач при создании Event (24h, 2h, finish)     |     2 |
| 15.3 | Reminder 24h job + idempotency                             |     2 |
| 15.4 | Reminder 2h + закрытие записи                              |     2 |
| 15.5 | TTL pending_payment 15 мин → отмена брони                  |     2 |
| 15.6 | Waitlist promotion с TTL 30 мин (с inline-confirm кнопкой) |     3 |
| 15.7 | Auto-finished для прошедших событий                        |     1 |
| 15.8 | Отмена задач при cancellation события                      |     1 |
| 15.9 | Tests с freeze time                                        |     3 |

## Definition of Done

- За 24 ч до события confirmed-игроки получают напоминание в Telegram
- За 2 ч — финальное напоминание + статус Event → closed
- Pending брони отменяются через 15 мин
- Из waitlist первый получает уведомление с inline-кнопкой, TTL 30 мин
- Прошедшие тренировки → finished автоматически через 30 мин
- Задачи переживают рестарт (persistent jobstore)
- ≥ 5 тестов с freeze time
