---
id: '8.5'
phase: '8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Подключение notifier во все точки 5-6. Вызовы ПОСЛЕ коммита.'
estimated_hours: '6-8'
depends_on: ['8.4']
---

# Epic 8.5: Уведомления (booking/payment/promotion/cancel)

**Цель.** Подключить уведомления во все точки, отложенные в Phase 5-6: booking confirmed, waitlist promotion, payment confirmed/rejected, event cancelled, pending payment организатору.

## Контекст

Скелет (сессия 2). Решение 6: все перечисленные уведомления. Точки уже помечены в коде 5-6 (booking allocation, promotion, payment confirm/refund, mass refund).

## Definition of Done

- booking confirmed → игроку
- waitlist promotion → игроку (важное!)
- payment confirmed/rejected → игроку
- event cancelled → всем участникам
- pending payment created → организатору (новая бронь ждёт)
- Все вызовы notifier ВНЕ транзакций (после коммита)

## Задачи

| ID    | Задача                                                                  | Часов |
| ----- | ----------------------------------------------------------------------- | ----: |
| 8.5.1 | Паттерн post-commit notify + booking уведомления (confirmed/waitlisted) |   2-3 |
| 8.5.2 | Payment уведомления (confirmed, rejected, pending→organizer)            |     2 |
| 8.5.3 | Event cancelled (mass) + promotion уведомления                          |   1-2 |

## Не делать

- ❌ Reminders за 24ч — Phase 15
- ❌ Детали — в сессии 2
