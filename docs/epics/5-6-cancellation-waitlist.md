---
id: '5.6'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Отмена брони с restore session + synchronous waitlist promotion.'
estimated_hours: '4-6'
depends_on: ['5.3', '5.5']
---

# Epic 5.6: Cancellation + waitlist promotion

**Цель.** Реализовать отмену брони: восстановление сессии абонемента (если был), проверка cancellation deadline, и synchronous продвижение первого из waitlist в confirmed.

## Контекст

Связывает bookings (5.3) и subscriptions (5.5). Решение 13: promotion synchronous (отмена → сразу следующий в confirmed), без уведомлений и TTL. Решение 14: cancellation deadline настраивается per-event.

Логика из прототипа: при отмене confirmed-брони освобождается слот → первый waitlisted (по времени записи) продвигается.

## Definition of Done

- BookingService.cancel — транзакционно:
  - Проверка: бронь принадлежит user (или owner/organizer отменяет)
  - Проверка cancellation deadline (если event.cancellation_deadline_hours задан и дедлайн прошёл → отказ, кроме owner/organizer)
  - Если booking был с subscription → restoreSession (used -= 1)
  - Booking status → cancelled
  - Если это был confirmed слот → promote первого из waitlist
- Waitlist promotion:
  - Найти первый waitlisted booking (по created_at ASC)
  - Перевести в confirmed
  - Если promoted был pending_payment — остаётся method, статус confirmed (слот закреплён)
- Promotion synchronous внутри той же транзакции
- Edge cases: отмена waitlisted брони (просто cancel, без promotion); отмена когда waitlist пуст
- Cancellation deadline bypass для owner/organizer
- Audit (booking.cancelled, booking.promoted)
- Тесты включая: cancel с restore, promotion chain, deadline enforcement

## Задачи

| ID    | Задача                                           | Часов |
| ----- | ------------------------------------------------ | ----: |
| 5.6.1 | BookingService.cancel + deadline check + restore |     2 |
| 5.6.2 | Waitlist promotion (synchronous)                 |   1-2 |
| 5.6.3 | Edge cases + integration тесты                   |   1-2 |

## Не делать

- ❌ Не делать TTL-подтверждение promotion — Phase 15 (синхронный промоушн пока)
- ❌ Не делать уведомление промоутнутому игроку — Phase 8
- ❌ Не делать refund денег при отмене — Phase 6
- ❌ Не делать массовую отмену (отмена события целиком с refund всем) — Phase 6
- ❌ Не делать партиал-промоушн (несколько из waitlist) — освобождается 1 слот = 1 промоушн
